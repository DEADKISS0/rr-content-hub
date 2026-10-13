// NX-1028 — rutas de lectura y escritura del plan de publicación.
//
//   GET  /api/social-plan?proyecto=wundeer   → plan + versión + estado
//   PUT  /api/social-plan                    → autoguardado con control de concurrencia
//   GET  /api/social-plan?proyecto=…&historial=1 → historial recuperable
//
// La escritura es OPTIMISTA: el cliente manda la versión que leyó. Si otra
// persona guardó primero, el servidor responde 409 con la versión actual y NO
// pisa nada — la interfaz queda en estado 'conflicto' y puede recargar.
//
// Permisos (NX-1028 paso 3, corregidos en NX-1030 H1): la matriz de
// `social-permissions.ts` manda aquí y en la página, desde el mismo archivo,
// y ahora se lee con el veredicto COMPLETO (`permisosSocialesDeVeredicto`), no
// con el rol a secas. Sin sesión no se lee ni se escribe (visitante sin
// acceso); con sesión y sin fila en ESTE proyecto → 403, así una cookie de un
// cliente no lee el plan de otro; sin tabla (modo demo) → se lee, que es lo
// que mide el E2E. `client_viewer` lee; `client_approver` solo puede
// aprobar o pedir cambios, y eso se comprueba contra el plan GUARDADO: si su
// PUT toca algo que no sea estado o comentario, es 403. El equipo edita,
// ordena y programa. No hay ninguna ruta de borrado irreversible: ni DELETE,
// ni `archivar()` deja de ser reversible.
import { NextRequest, NextResponse } from 'next/server';

import { getProject } from '@/lib/data';
import { rolEnProyecto } from '@/lib/project-guard';
import { quienEs } from '@/lib/quien-es';
import {
  MOTIVO_SIN_PERMISO,
  permisosSocialesDeVeredicto,
  soloCambioDeAprobacion,
} from '@/lib/social-permissions';
import type { SocialPost } from '@/lib/social-planning';
import { socialStore } from '@/lib/social-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Cuerpo = {
  projectSlug?: string;
  posts?: SocialPost[];
  pautas?: SocialPost[];
};

function error(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Techo del cuerpo del PUT: un plan real de un mes no pasa de unos cientos de KB. */
const LIMITE_CUERPO_BYTES = 1_000_000;

/** ¿Esta pieza tiene al menos la forma mínima de una publicación? */
function piezaValida(pieza: unknown): boolean {
  if (!pieza || typeof pieza !== 'object') return false;
  const p = pieza as Record<string, unknown>;
  return typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 128;
}

function coleccionValida(coleccion: unknown): coleccion is SocialPost[] {
  return Array.isArray(coleccion) && coleccion.length <= 500 && coleccion.every(piezaValida);
}

type LecturaCuerpo =
  | { estado: 'ok'; texto: string }
  | { estado: 'demasiado' }
  | { estado: 'ilegible' };

/**
 * Lee el cuerpo del PUT limitando el STREAM, no la cabecera.
 *
 * H2 (NX-1030): el techo vivía en `Number(headers.get('content-length') ?? '0')`,
 * que vale 0 cuando la petición llega chunked — sin cabecera no hay 413,
 * `request.json()` leía el cuerpo completo y `coleccionValida()` solo limita
 * cantidad de piezas y longitud del `id`, no los bytes. Un cuerpo enorme con
 * 500 piezas válidas pasaba. Aquí el techo se aplica mientras se lee: al
 * superar `LIMITE_CUERPO_BYTES` se cancela el lector y se responde 413, con
 * o sin `content-length`.
 */
async function leerCuerpoLimitado(request: NextRequest): Promise<LecturaCuerpo> {
  const flujo = request.body;
  if (!flujo) return { estado: 'ilegible' };

  const lector = flujo.getReader();
  const partes: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > LIMITE_CUERPO_BYTES) {
      // Se corta la lectura, no solo la respuesta: seguir consumiendo un
      // cuerpo que ya sabemos gigante es gastar memoria por deporte.
      await lector.cancel().catch(() => undefined);
      return { estado: 'demasiado' };
    }
    partes.push(value);
  }

  // Se concatena entero y se decodifica una sola vez: decodificar trozo a
  // trozo partiría por medio cualquier acento que caiga en el corte.
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const parte of partes) {
    buffer.set(parte, offset);
    offset += parte.byteLength;
  }
  try {
    return { estado: 'ok', texto: new TextDecoder('utf-8', { fatal: true }).decode(buffer) };
  } catch {
    return { estado: 'ilegible' };
  }
}

export async function GET(request: NextRequest) {
  const proyecto = request.nextUrl.searchParams.get('proyecto')?.trim().toLowerCase();
  if (!proyecto) return error('Falta el proyecto.', 400);

  // Visitante sin acceso: el plan es material del proyecto y no se lee sin
  // pasar la puerta. Antes el GET estaba abierto y el plan completo salía para
  // cualquiera con la URL.
  const sesion = await quienEs();
  if (!sesion) return error(MOTIVO_SIN_PERMISO.leer, 401);

  // Hallazgo F1 (NX-1029) / H1 (NX-1030): la sesión no basta. Cualquier cookie
  // de hub —incluida la de OTRO cliente— leía el plan y el historial de
  // cualquier proyecto, porque el rol `sin_rol` (sin fila en ESTE proyecto)
  // heredaba lectura y la ruta no miraba `via`. Aquí manda el veredicto
  // COMPLETO: con tabla y sin fila → 403; sin tabla (demo) → se lee.
  const { project } = await getProject(proyecto);
  const veredictoLectura = project ? await rolEnProyecto(project.id) : null;
  if (!permisosSocialesDeVeredicto(veredictoLectura).puedeLeer) {
    return error(MOTIVO_SIN_PERMISO.leer, 403, { motivo: 'sin-permiso' });
  }

  const store = await socialStore();

  if (request.nextUrl.searchParams.get('historial') === '1') {
    const entradas = await store.historial(proyecto);
    return NextResponse.json({ historial: entradas }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const plan = await store.leer(proyecto);
  if (!plan) {
    // Sin fila guardada aún: la UI pinta el plan base. 200 y no 404 — «nadie ha
    // guardado» no es un error, es el estado inicial de siempre.
    return NextResponse.json({ plan: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ plan }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest) {
  const sesion = await quienEs();
  if (!sesion) return error('Sin sesión no se guarda.', 401);

  // Hallazgo F4 (NX-1029) y H2 (NX-1030): el cuerpo venía sin techo ni forma.
  // Un payload de cientos de megabytes o un `posts: ['x']` llegaba hasta el
  // almacén. El techo se aplica LEYENDO EL STREAM (ver `leerCuerpoLimitado`),
  // no midiendo `content-length`: esa cabecera no existe en chunked y sin ella
  // el tope anterior no disparaba ni un 413.
  const lectura = await leerCuerpoLimitado(request);
  if (lectura.estado === 'demasiado') {
    return error('Plan demasiado grande para guardarse de una vez.', 413);
  }
  if (lectura.estado === 'ilegible') {
    return error('Cuerpo ilegible.', 400);
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = JSON.parse(lectura.texto) as Cuerpo;
  } catch {
    return error('Cuerpo ilegible.', 400);
  }

  if (typeof cuerpo.projectSlug !== 'string' || !cuerpo.projectSlug.trim()) {
    return error('Falta el proyecto.', 400);
  }
  if (!coleccionValida(cuerpo.posts) || !coleccionValida(cuerpo.pautas)) {
    return error('Plan incompleto o inválido: revisa las publicaciones y pautas.', 400);
  }

  const versionParam = request.nextUrl.searchParams.get('v');
  const versionEsperada = versionParam === null ? Number.NaN : Number(versionParam);
  if (!Number.isInteger(versionEsperada) || versionEsperada < 0) {
    return error('Falta la versión que se leyó (?v=N).', 400);
  }

  const projectSlug = cuerpo.projectSlug.trim().toLowerCase();
  const store = await socialStore();
  // Sin anotación de tipo a propósito: `guardar()` recibe el plan SIN versión ni
  // fecha (esas las pone el almacén) y el tipo exacto vive en `social-store.ts`.
  //
  // Hallazgo F2 (NX-1029): `updatedBy` salía del CUERPO, así que cualquiera
  // podía firmar el historial con el nombre de otra persona. La atribución la
  // pone solo el servidor, desde la cookie de sesión.
  const plan = {
    projectSlug,
    posts: cuerpo.posts,
    pautas: cuerpo.pautas,
    updatedBy: sesion.nombre || sesion.email,
  };

  // La matriz, en el servidor. Mismo rol que resuelve la página del proyecto
  // (`rolEnProyecto`), para que la UI y esta puerta cuenten la misma historia:
  // un botón que se ve tiene que poder pulsarse.
  const { project } = await getProject(projectSlug);
  const veredicto = project ? await rolEnProyecto(project.id) : null;
  const permisos = permisosSocialesDeVeredicto(veredicto);

  if (!permisos.puedeEditar) {
    if (!permisos.puedeAprobar) {
      return error(MOTIVO_SIN_PERMISO.editar, 403, { motivo: 'sin-permiso' });
    }
    // Un aprobador llega por el MISMO PUT porque el autoguardado no distingue
    // rutas. Entonces se compara su plan contra el guardado: si solo cambian
    // `estado` y `feedbackCambio`, aprueba; si toca contenido, orden, portada
    // o fecha, es 403 — quien aprueba no reescribe la publicación.
    const guardado = await store.leer(projectSlug);
    if (!guardado || !soloCambioDeAprobacion(guardado, plan)) {
      return error(MOTIVO_SIN_PERMISO.aprobar, 403, { motivo: 'solo-aprobacion' });
    }
  }

  const resultado = await store.guardar(plan, versionEsperada);
  if (!resultado.ok) {
    if (resultado.motivo === 'conflicto') {
      return NextResponse.json(
        {
          error: 'Otra persona guardó primero. Recarga antes de seguir editando.',
          motivo: 'conflicto',
          versionActual: resultado.versionActual,
        },
        { status: 409 },
      );
    }
    return error('Plan inválido.', 400);
  }
  return NextResponse.json({ plan: resultado.plan });
}
