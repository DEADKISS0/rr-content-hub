/*
 * El logo del cliente en la cabecera.
 *
 * MEDIDO 2026-10-05 (feedback de Santiago: «aquí quiero el logo de wundeer»): la
 * barra superior decía «WUNDEER · TODO EL CONTENIDO EN UN LUGAR» en monoespaciada
 * gris. Un nombre en una barra es lo que dice cualquier sistema; el logo es lo
 * que hace que la pantalla se vea del cliente y no del hub genérico.
 *
 * DE DÓNDE VIENE LA URL (medido el 2026-10-05):
 *  - El bucket `rr-content-assets` SOLO admite imágenes. Un SVG da HTTP 415
 *    `invalid_mime_type`, así que el logo se sube como PNG (el isotipo y el
 *    lockup observados vinieron del brand kit del cliente, no se dibujan aquí).
 *  - Las URLs viven en `/public/logos/<slug>.png`, que Next sirve como estático.
 *    Si un cliente no tiene logo, `LOGO_POR_CLIENTE` no lo tiene y la cabecera
 *    cae al texto, que es lo que hay que hacer: un hueco se ve; un logo
 *    inventado o una imagen rota se ven peor.
 *  - El nombre del archivo es el slug del proyecto. Añadir un cliente con logo es
 *    una línea en el mapa y un archivo en `public/logos/`.
 */

/** Slug del proyecto → ruta del logo en `public/`. */
const LOGO_POR_CLIENTE: Record<string, string> = {
  wundeer: '/logos/wundeer.png',
};

/** Slugs sin logo: se listan para que quede claro que es una decisión, no un olvido. */
export const SIN_LOGO = ['candilejas'] as const;

/**
 * Ruta del logo para un cliente, o `null` si no tiene.
 *
 * Un nombre que no está en el mapa devuelve `null` y no una ruta inventada: el
 * `<img>` con una ruta que no existe muestra el ícono roto del navegador, que
 * en una barra superior es peor que no mostrar nada.
 */
export function logoDeCliente(slug: string): string | null {
  return LOGO_POR_CLIENTE[slug] ?? null;
}