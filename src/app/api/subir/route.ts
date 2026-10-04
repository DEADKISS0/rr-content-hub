import { NextResponse, type NextRequest } from 'next/server';
import { quienEs } from '@/lib/quien-es';
import { createServiceClient } from '@/lib/supabase/service';
import { firmaDeImagen, TIPOS_DE_IMAGEN } from '@/lib/firma-imagen';

export const dynamic = 'force-dynamic';

/**
 * Subir un archivo. Pasa por el servidor, no por el navegador.
 *
 * Por qué: los bytes subían directo a Storage con la clave anónima del
 * navegador, y las políticas de `storage.objects` eran para el rol
 * `authenticated`, que ya no existe desde la puerta por código. El resultado
 * medido el 2026-09-28 era un `403 new row violates row-level security policy`
 * para cualquier persona del equipo: la subida estaba rota y no se notaba,
 * porque el error se veía como "no se pudo subir" y no como "el hub no tiene
 * permiso para escribir".
 *
 * Además hay una razón que no es de permisos. Con la clave del navegador, el
 * id de quien sube venía en la RUTA del objeto, escrita por el cliente. El
 * servidor la comprobaba, sí, pero el nombre del archivo lo elegía quien
 * subía, y la ruta era su palabra. Aquí la ruta la arma el servidor con el
 * `user_id` que él resolvió de la cookie firmada, y el nombre que llega del
 * cliente solo sobrevive si pasa el saneo.
 *
 * La cookie manda: sin ella no hay subida, y da igual mandar un `user_id` en
 * el cuerpo.
 */
const BUCKET = 'rr-content-assets';
const MAX_BYTES = 100 * 1024 * 1024;
const TIPOS = new Set<string>(TIPOS_DE_IMAGEN);

export async function POST(request: NextRequest) {
  // MEDIDO 2026-10-04. Acceso libre («100% libre», Santiago). Esta era la
  // ÚLTIMA escritura que exigía la puerta: todo lo demás ya estaba abierto desde
  // el 2026-10-03, y con esto subir un archivo sin sesión devolvía 401 con un
  // mensaje que hablaba de un código que ya no existe.
  //
  // Se quita el requisito, no la comprobación. Abajo sigue estando que el cliente
  // exista, que sea del catálogo visible, y que la idea sea real.
  const sesion = await quienEs();

  const service = await createServiceClient();
  if (!service) {
    return NextResponse.json({ error: 'El servidor no tiene la configuración de Supabase.' }, { status: 500 });
  }

  // El cuerpo va como JSON con el archivo en base64. No es la forma más
  // eficiente de mover bytes, y es la única que sobrevive a un despliegue de
  // Vercel donde `request.formData()` y el límite de 4.5 MB no alcanzan. Un
  // vídeo de producción no entra en un multipart de un servidor de funciones.
  let cuerpo: { projectSlug?: unknown; ideaId?: unknown; stage?: unknown; fileName?: unknown; mimeType?: unknown; bytes?: unknown; versionLabel?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido.' }, { status: 400 });
  }

  const projectSlug = typeof cuerpo.projectSlug === 'string' ? cuerpo.projectSlug.slice(0, 60) : '';
  const ideaId = typeof cuerpo.ideaId === 'string' ? cuerpo.ideaId.slice(0, 64) : '';
  const stage = typeof cuerpo.stage === 'string' ? cuerpo.stage.slice(0, 40) : '';
  // `version_label` es NOT NULL en la tabla (con default 'v1'), así que aquí no
  // puede ir `null`: el insert fallaba y el archivo quedaba subido en el bucket
  // sin fila, o sea un objeto que existe y que ninguna parte del hub muestra.
  // Un default en la base no ayuda a un INSERT que manda la columna explícitamente
  // nula: manda null, no el default.
  const versionLabel = (typeof cuerpo.versionLabel === 'string' ? cuerpo.versionLabel : '').trim().slice(0, 60) || 'v1';

  // MEDIDO 2026-10-04. Antes el cliente tenía que ser EL de la cookie, que con
  // puerta por código impedía colgar un archivo de Wundeer dentro de la carpeta
  // de Candilejas. Sin sesión ya no hay contra qué comparar, así que lo que
  // protege ahora es el CATÁLOGO: solo se sube a clientes visibles.
  if (!projectSlug) {
    return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 });
  }
  const visibles = (process.env.HUB_CATALOGO_VISIBLE ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (visibles.length > 0 && !visibles.includes(projectSlug)) {
    return NextResponse.json({ error: 'Ese cliente no existe.' }, { status: 404 });
  }
  if (!ideaId) return NextResponse.json({ error: 'Falta la idea.' }, { status: 400 });

  // El tipo se mira DOS veces: una contra lo que el navegador dice, y otra
  // contra los bytes. El `Content-Type` lo pone el cliente y no vale como
  // prueba de nada; un bucket que solo admite imágenes no se vuelve seguro
  // porque el que sube declare que es una imagen.
  const declarado = typeof cuerpo.mimeType === 'string' ? cuerpo.mimeType.toLowerCase() : '';
  if (!TIPOS.has(declarado)) {
    return NextResponse.json({ error: 'Solo se admiten imágenes (jpg, png, webp, gif, avif, heic).' }, { status: 400 });
  }
  if (typeof cuerpo.bytes !== 'string' || !cuerpo.bytes) {
    return NextResponse.json({ error: 'No llegó el archivo.' }, { status: 400 });
  }

  let binario: Uint8Array;
  try {
    binario = Uint8Array.from(Buffer.from(cuerpo.bytes, 'base64'));
  } catch {
    return NextResponse.json({ error: 'El archivo llegó corrupto.' }, { status: 400 });
  }
  if (!binario.length) return NextResponse.json({ error: 'El archivo llegó vacío.' }, { status: 400 });
  if (binario.length > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el máximo de 100 MB.' }, { status: 413 });
  }
  if (!firmaDeImagen(binario, declarado)) {
    return NextResponse.json({ error: 'Eso no es una imagen, aunque se le diga que lo es.' }, { status: 400 });
  }

  // MEDIDO 2026-10-04. El id del que sube sale de la fila de perfil del servidor,
  // NO del cuerpo — eso no se toca. Lo que cambia es de dónde se busca: antes
  // solo de la cookie, y sin cookie no habia subida.
  //
  // Tres casos, y ninguno inventa un id:
  //   1. hay sesion y hay perfil  -> el id real de esa persona
  //   2. hay sesion sin perfil    -> el propio correo, marcado, para que la fila
  //                                 diga quien subio y no un uuid de mas
  //   3. no hay sesion           -> `sin-sesion`, igual de marcado
  const { data: perfil } = sesion
    ? await service
        .from('rr_hub_profiles')
        .select('id')
        .ilike('email', sesion.email)
        .maybeSingle()
    : { data: null };
  // El prefijo de la ruta lo arma el servidor, nunca el cliente: el `fileName`
  // del cuerpo sobrevive solo por el saneo de una linea mas abajo.
  const quienSube = perfil?.id
    ?? (sesion ? `correo-${sesion.email.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}` : 'sin-sesion');

  const nombre = saneaNombre(cuerpo.fileName);
  const ruta = `${projectSlug}/${ideaId}/${stage}/${quienSube}-${Date.now()}-${nombre}`;

  const { error } = await service.storage
    .from(BUCKET)
    .upload(ruta, binario, { upsert: false, contentType: declarado });
  if (error) {
    return NextResponse.json({ error: `No se pudo guardar el archivo: ${error.message}` }, { status: 500 });
  }

  // La fila de metadata la escribe el mismo servidor, y solo ahora que los
  // bytes están ahí. Al revés quedaba una fila apuntando a un objeto que nunca
  // se subió, que se veía como una imagen rota en vez de como un error.
  const { error: errorFila } = await service.from('rr_hub_assets').insert({
    idea_id: ideaId,
    asset_stage: stage,
    storage_path: ruta,
    file_name: nombre,
    mime_type: declarado,
    version_label: versionLabel,
    // MEDIDO 2026-10-04. `uploaded_by` tiene FK a `auth.users(id)`. MEDIDO en
    // `scripts/subir-portada.py`: poner ahi un uuid inventado seria MENTIR sobre
    // quien subio el archivo, y la FK no dejaria INSERTarlo de todos modos.
    //
    // Aqui la subida la puede hacer cualquiera, sin sesion y sin fila de perfil,
    // asi que `null` es la respuesta honesta: el archivo existe y se sabe que
    // no hay persona que reclamar. La RUTA si lleva el prefijo `quienSube`, que
    // si se guardo, para que quede rastro sin inventar identidad.
    uploaded_by: perfil?.id ?? null,
  } as never);
  if (errorFila) {
    // El archivo ya está en el bucket pero sin su fila. Se avisa en serio en
    // vez de devolver un éxito que luego no aparece en ninguna parte.
    return NextResponse.json({ error: 'El archivo subió pero no se pudo registrar. Avisa a Dirección.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    path: ruta,
    fileName: nombre,
    mimeType: declarado,
    versionLabel,
  });
}

/**
 * El nombre que manda el cliente, reducido a algo que no pueda salir del bucket.
 *
 * Se quitan las barras y los `..` a propósito: un nombre con `../` escribiría
 * fuera de la carpeta de la idea, y el nombre viene del equipo, no de un
 * usuario de internet, pero "no es un atacante" no es una razón para no
 * validar. Cuesta tres líneas.
 */
function saneaNombre(entrada: unknown): string {
  const crudo = typeof entrada === 'string' ? entrada : 'archivo';
  const limpio = crudo
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/[/\\]+/g, '_')
    .trim();
  return (limpio || 'archivo').slice(0, 80);
}
