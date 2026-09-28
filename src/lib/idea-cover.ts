/**
 * Portada de una idea: qué imagen se pinta en la tarjeta.
 *
 * La columna `rr_hub_ideas.cover_asset_id` (migración 20260928_hub_idea_cover)
 * es el puntero a un `rr_hub_assets` con `asset_stage = 'reference_brief'`. Este
 * módulo NO vuelve a decidir cuál es: la base ya lo resuelve con
 * `rr_hub_idea_cover(idea_id)`. Aquí solo se toma la decisión de PINTARLO.
 *
 * Por qué está separado de `flow.ts` y de los componentes: la regla de "si hay
 * portada real, la muestro; si no, el placeholder con el título" es la que hay
 * que poder testear sin navegador ni base de datos, y ese es el mismo criterio
 * que usa el resto del repo (`reference.ts` con sus tests, `votacion.ts`...).
 *
 * El placeholder NO es un recuadro vacío: es el marco con el título de la idea,
 * para que una pieza sin brief siga leyéndose como contenido y la parrilla no
 * parezca un error. Esa decisión ya está tomada en `ui/cover.tsx` (el arte de
 * marca determinista) y aquí no se duplica.
 */

/** Lo que el RPC `rr_hub_idea_cover` devuelve para una idea. */
export type IdeaCover = {
  asset_id: string;
  file_name: string | null;
  mime_type: string | null;
  external_url: string | null;
  storage_path: string | null;
} | null;

/**
 * ¿El asset serves para pintarse como imagen?
 *
 * Dos criterios, y los dos hacen falta:
 *
 *  1. Tiene una URL que el navegador puede abrir. `external_url` es pública;
 *     `storage_path` NO: es una ruta del bucket privado, y ponerla tal cual en
 *     un `src` produce un 403. Ese paso de firma es del servidor y no se puede
 *     saltarse desde el cliente, así que aquí solo se acepta `external_url`.
 *  2. Dice ser una imagen. Un brief puede ser un PDF o un .docx, y meterlo en
 *     un `<img>` da el ícono de imagen rota del navegador.
 *
 * El `mime_type` manda sobre la extensión del nombre: el nombre lo elige quien
 * sube el archivo, y un `brief.jpg` que en realidad es un PDF es justo el caso
 * que rompe la tarjeta sin avisar.
 */
const IMAGE_MIME = /^image\//i;

export function esImagenPintable(asset: {
  mime_type?: string | null;
  external_url?: string | null;
  file_name?: string | null;
}): boolean {
  if (!asset.external_url) return false;

  const mime = asset.mime_type?.trim();
  if (mime) return IMAGE_MIME.test(mime);

  // Sin mime_type: se cae al nombre, que es menos fiable pero mejor que nada.
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(asset.file_name ?? '');
}

/** URL lista para el `src` de un `<img>`, o `null` si no se puede pintar. */
export function urlDePortada(asset: IdeaCover): string | null {
  if (!asset || !esImagenPintable(asset)) return null;
  return asset.external_url;
}

/**
 * Qué se pinta en el marco de la tarjeta.
 *
 * `imagen` es la URL real; `placeholder` significa que la idea vuelve al marco
 * con su título. Devolver un discriminado y no un JSX permite testear la
 * decisión aquí y dejar el marcado en el componente.
 */
export type CoverDecision =
  | { kind: 'imagen'; url: string; alt: string }
  | { kind: 'placeholder' };

export function decidirPortada(
  idea: { title: string; code?: string | null },
  asset: IdeaCover,
): CoverDecision {
  const url = urlDePortada(asset);
  if (!url) return { kind: 'placeholder' };

  const referencia = idea.code ? `Portada de ${idea.code}` : 'Portada de la idea';
  // El título va dentro del alt, no solo el código: para quien usa lector de
  // pantalla la imagen tiene que decir de qué pieza es.
  return { kind: 'imagen', url, alt: `${referencia}: ${idea.title}` };
}
