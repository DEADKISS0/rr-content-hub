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
  const sesion = await quienEs();
  if (!sesion) {
    return NextResponse.json({ error: 'Entra con el código de tu cliente para subir archivos.' }, { status: 401 });
  }

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

  // El cliente tiene que ser EL de la cookie. Sin esto, con el código de
  // Wundeer se podría colgar un archivo dentro de la carpeta de Candilejas.
  if (!projectSlug || projectSlug !== sesion.proyecto) {
    return NextResponse.json({ error: 'Ese cliente no es el tuyo.' }, { status: 403 });
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

  // El id sale de la cookie, no del cuerpo. Antes venía en la ruta que armaba
  // el cliente, o sea que la ruta era su palabra.
  const { data: perfil } = await service
    .from('rr_hub_profiles')
    .select('id')
    .ilike('email', sesion.email)
    .maybeSingle();
  if (!perfil) {
    return NextResponse.json({ error: 'No reconocemos tu correo en la lista del equipo.' }, { status: 403 });
  }

  const nombre = saneaNombre(cuerpo.fileName);
  const ruta = `${projectSlug}/${ideaId}/${stage}/${perfil.id}-${Date.now()}-${nombre}`;

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
    uploaded_by: perfil.id,
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
