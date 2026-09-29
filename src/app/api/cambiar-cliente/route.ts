import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { crearSesion, NOMBRE_COOKIE } from '@/lib/hub-session';
import { quienEs } from '@/lib/quien-es';
import { CLIENTES_CONOCIDOS } from '@/lib/projects';

/**
 * Cambiar de cliente sin salir del hub.
 *
 * Por qué existe: cada código abre un solo cliente, así que la forma de pasar de
 * Wundeer a Candilejas era cerrar sesión y teclear el otro código. Con tres o
 * cuatro clientes eso es un peaje por cada salto, y quien lo教育厅aba se quedaba
 * en el primero.
 *
 * ⚠️ La decisión —"cambio de cliente" sin volver a teclear el código— es de
 * Santiago (2026-09-29). Las dos condiciones que hacen que no sea abrir el hub:
 *
 * 1. **El correo decide, no el código.** Solo se puede pasar a un cliente donde
 *    esa persona ya tenga fila en `rr_hub_access`. El código solo confirmó la
 *    puerta la primera vez; el código de Candilejas no le da a nadie acceso a
 *    Wundeer. Así que el selector puede ofrecer los que tu correo ya abre, y
 *    marcar con candado los demás — que es exactamente lo que pidió.
 * 2. **La fila tiene que estar activa y ser del equipo.** Se leen
 *    `is_team_member` e `is_active` antes de emitir nada, igual que en el voto:
 *    que alguien se registrara ayer no lo convierte en alguien con acceso.
 *
 * Lo que NO hace:
 * - No acepta un código. Si quieres añadir un cliente al que no tienes acceso,
 *   eso es un alta de acceso, y lo hace una persona; no esta ruta.
 * - No amplía permisos. La sesión nueva lleva el rol que esa persona tiene en
 *   ESE cliente, que puede ser `client_viewer` aunque en el otro sea `owner`.
 * - No deja el rol anterior pegado. Se resuelve entero desde la base otra vez.
 */
export const dynamic = 'force-dynamic';

/** El rol que esa persona tiene en el cliente al que va a entrar. */
type Fila = { role_in_project: string; is_team_member: boolean; is_active: boolean };

export async function POST(request: NextRequest) {
  const sesion = await quienEs();
  if (!sesion) {
    return NextResponse.json(
      { error: 'Entra con el código de tu cliente para poder cambiar.' },
      { status: 401 },
    );
  }

  const cuerpo = (await request.json().catch(() => null)) as { proyecto?: string } | null;
  const destino = String(cuerpo?.proyecto ?? '').trim().toLowerCase();
  if (!destino) {
    return NextResponse.json({ error: 'Falta el cliente al que quieres pasar.' }, { status: 400 });
  }

  // La lista corta, no la de autorización: un slug tiene que ser uno de los
  // conocidos para que un inventado no abra nada.
  if (!(CLIENTES_CONOCIDOS as readonly string[]).includes(destino)) {
    return NextResponse.json({ error: 'Ese cliente no existe.' }, { status: 404 });
  }

  // Volver al mismo cliente no es cambiar: es un no-op. Se responde bien, para
  // que el selector no se ponga rojo si alguien pulsa el que ya está abierto.
  if (destino === sesion.proyecto) {
    return NextResponse.json({ success: true, proyecto: destino, rol: null });
  }

  const supabase = await createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'El sistema de acceso no está configurado.' }, { status: 503 });
  }

  // La fila de acceso se cruza en memoria: `rr_hub_access.user_id` tiene FK a
  // `auth.users` y `rr_hub_profiles.id` es su PK, y ENTRE LAS DOS NO HAY FK
  // (medido el 2026-09-29 en `pg_constraint`). Un embed devuelve PGRST200 con
  // `data: null` sin lanzar, y esa consulta rota costó un día entero: todo el
  // equipo en `sin_rol` y la puerta abierta sin una sola transición.
  // El perfil va PRIMERO: su `id` es el `user_id` que se busca después en
  // `rr_hub_access`. Las dos consultas no se pueden lanzar en paralelo si la
  // segunda depende de la primera, y el error de hacerlo así era silencioso:
  //
  // La primera versión filtraba `rr_hub_access` solo por proyecto, SIN `user_id`.
  // Devolvía todas las filas de los dos clientes y `find()` cogía la primera.
  // Medido el 2026-09-29: tu correo es `owner` en los cuatro clientes, la fila
  // que le tocó fue la de otra persona, y la API respondió `rol: creator` sin que
  // nadie lo notara. Un permiso que se concede a la persona equivocada es peor
  // que un permiso que falta: se ve funcionar.
  const { data: perfil, error: perfilError } = await supabase
    .from('rr_hub_profiles')
    .select('id, email, full_name, is_team_member, is_active')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (perfilError) return NextResponse.json({ error: perfilError.message }, { status: 500 });
  if (!perfil) {
    return NextResponse.json({ error: 'Tu correo no está en la lista del equipo.' }, { status: 403 });
  }
  if (!perfil.is_team_member) {
    return NextResponse.json({ error: 'Tu cuenta existe pero no eres del equipo.' }, { status: 403 });
  }
  if (!perfil.is_active) {
    return NextResponse.json({ error: 'Tu fila está desactivada, así que no puedes cambiar de cliente.' }, { status: 403 });
  }

  // Y ahora la fila de esa persona, con `user_id` en la consulta. Sin ese
  // filtro salen TODAS las filas de acceso de los dos clientes y `find()` se
  // lleva el rol de quien salga primero — que fue el primer bug de esta ruta.
  const { data: acceso, error: accesoError } = await supabase
    .from('rr_hub_access')
    .select('role_in_project, project:rr_hub_projects!inner(slug)')
    .eq('user_id', perfil.id);
  if (accesoError) return NextResponse.json({ error: accesoError.message }, { status: 500 });

  // El embed de `rr_hub_projects` sí funciona: la columna `project_id` tiene su
  // FK a esa tabla. El problema del 2026-09-28 era entre `rr_hub_access` y
  // `rr_hub_profiles`, que no tienen relación entre sí.
  //
  // Y devuelve un ARRAY, no un objeto, aunque apunte a una sola fila: el proyecto
  // llega como `[{...}]` y `fila.project.slug` da `undefined`, la comparación
  // falla y el `find` devuelve nada — que se lee como "no tienes acceso" sin
  // serlo. Por eso se aceptan las dos formas.
  const filaDeDestino = (acceso ?? []).find((fila: { project?: unknown }) => {
    const proyecto = fila.project;
    const slug = Array.isArray(proyecto)
      ? (proyecto[0] as { slug?: string } | undefined)?.slug
      : (proyecto as { slug?: string } | null)?.slug;
    return slug === destino;
  }) as (Fila & { project?: unknown }) | undefined;

  if (!filaDeDestino) {
    return NextResponse.json(
      { error: `No tienes acceso a ese cliente. Se lo pides a quien administra el hub.` },
      { status: 403 },
    );
  }

  const nombre = perfil.full_name || sesion.nombre;

  const respuesta = NextResponse.json({
    success: true,
    proyecto: destino,
    rol: filaDeDestino.role_in_project,
    // Se dice cuál era, para que la interfaz pueda explicar el cambio en vez de
    // aparecer en un tablero distinto sin explicación.
    desde: sesion.proyecto,
    nombre,
  });
  // Misma cookie y mismos atributos que emite `/api/entrar`: si se firmara con
  // otro lifetimes o sin `secure`, la sesión que naciera aquí duraría lo que
  // durase la que se creó en la puerta, que es justo lo que se quiere evitar.
  const sesionNueva = crearSesion({ email: sesion.email, nombre, proyecto: destino });
  respuesta.cookies.set(NOMBRE_COOKIE, sesionNueva.valor, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sesionNueva.maxAge,
  });
  return respuesta;
}
