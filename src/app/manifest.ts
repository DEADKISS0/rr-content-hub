import type { MetadataRoute } from 'next';

/**
 * El manifest de la PWA del hub.
 *
 * Santiago, 2026-09-30: "hasta que se pueda descargar como 'app' con el icono de
 * RR desde el navegador, asi como acceso directo desde Android y iPhone".
 *
 * QUE HACE ESTO Y QUE NO. Con esto el navegador ofrece "Instalar app" en
 * Chrome/Edge de escritorio y en Android, y en iPhone aparece "Añadir a
 * pantalla de inicio" desde el menu de compartir. La app no se descarga de una
 * tienda: se instala desde el propio sitio, y por eso necesita manifest,
 * iconos y un service worker (ver `public/sw.js`). Sin el service worker el
 * icono aparece pero la app no arranca sin conexion: eso lo anade
 * `src/components/instalar-app.tsx`.
 *
 * LOS ICONOS. Los genera `scripts/generar-iconos-app.mjs` desde el simbolo real
 * de RR, no desde el monograma con tipografia del Centro de Mando: en 32 px un
 * `<text>` con fuente del sistema se deforma. Los `maskable-*` son los mismos
 * con mas margen, porque Android recorta en circulo o en squircle.
 *
 * `id` fija la identidad de la app. Si cambia, Android la trata como una app
 * DISTINTA y a quien ya la tenía instalada le aparece otra vez. No se toca.
 */
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const icono = (file: string, size: string, tipo = 'image/png') => ({
    src: `/app/${file}`,
    sizes: size,
    type: tipo,
  });

  return {
    id: '/wundeer',
    name: 'RR Content Hub',
    short_name: 'RR Hub',
    description:
      'El banco de ideas de RR Aliados: piezas, voting, referencias y produccion, de Wundeer y Candilejas.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/wundeer',
    scope: '/',
    display: 'standalone',
    // La app se abre sin barra del navegador: es lo que la hace parecer app y no
    // una web metida en un marco. Con `minimal-ui` el boton de recarga desaparece
    // y la gente no sabe como actualizar.
    orientation: 'portrait-primary',
    background_color: '#070001',
    theme_color: '#070001',
    categories: ['productivity', 'business'],
    icons: [
      icono('icono-32.png', '32x32'),
      icono('icono-96.png', '96x96'),
      icono('icono-120.png', '120x120'),
      icono('icono-152.png', '152x152'),
      icono('icono-167.png', '167x167'),
      icono('icono-180.png', '180x180'),
      icono('icono-192.png', '192x192'),
      icono('icono-256.png', '256x256'),
      icono('icono-512.png', '512x512'),
      // Los maskable van al final y con `purpose` explicito: el mismo dibujo
      // cuenta para dos cosas y Android necesita saber cual es cual.
      { ...icono('maskable-192.png', '192x192'), purpose: 'maskable' },
      { ...icono('maskable-512.png', '512x512'), purpose: 'maskable' },
    ],
    // Donde aparece el atajo si el usuario lo anade a mano. `/wundeer` es el
    // cliente por defecto; a Candilejas se llega cambiando de cliente.
    shortcuts: [
      {
        name: 'Tablero de ideas',
        short_name: 'Tablero',
        url: '/wundeer/ideas',
        icons: [icono('icono-96.png', '96x96')],
      },
      {
        name: 'Entrada',
        short_name: 'Entrada',
        url: '/login',
        icons: [icono('icono-96.png', '96x96')],
      },
    ],
  };
}
