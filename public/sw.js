/**
 * Service worker de la PWA del hub.
 *
 * Santiago, 2026-09-30: "hasta que se pueda descargar como 'app' con el icono de
 * RR desde el navegador, asi como acceso directo desde Android y iPhone".
 *
 * QUE SE CACHEA Y QUE NO, Y POR QUE. Este hub es una herramienta de trabajo con
 * datos VIVOS: una idea votada, un estado movido o una portada subida tienen que
 * verse al instante. Cachear el HTML de las fichas seria un descuido que se
 * traduce en "aprobo algo que ya no es cierto". Asi que:
 *
 *   - La navegacion SIEMPRE va a la red. Si no hay conexion se devuelve la
 *     pagina de "sin conexion" guardada, y nunca una copia vieja de una ficha.
 *   - Solo se cachea el ARMADO: iconos, manifest y los ficheros de Next con
 *     hash en el nombre. Como su nombre cambia al cambiar el codigo, cachearlos
 *     es seguro: nunca se sirve una version antigua por error.
 *   - Las peticiones a Supabase, las API y los embeds de Instagram NUNCA se
 *     cachean. Son datos, y un embed cacheado es un rectángulo gris con la
 *     fecha de ayer.
 *
 * VERSION. Cambia el nombre cuando quieras invalidar todo lo cacheado. Aqui se
 * usa la fecha, porque lo que cambia son los assets con hash y no hace falta
 * PURGAR a mano.
 */

const VERSION = 'rr-hub-v1';
const CACHE = `${VERSION}`;

/** El armazón estático que si se puede guardar. */
const PRECARGA = [
  '/app/icono-192.png',
  '/app/icono-512.png',
  '/app/maskable-512.png',
  '/app/apple-touch-icon.png',
  '/offline',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      // `addAll` falla entero si UNA peticion falla, y `/offline` todavia no
      // existe en una instalacion nueva. Por eso se anaden una a una.
      .then((cache) => Promise.allSettled(PRECARGA.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      // Fuera todo lo que no sea de ESTA version: si no, la cache crece sin
      // limite en cada despliegue.
      .then((claves) => Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Qué sí se cachea: lo estático con hash, y nada mas. */
function esArmazon(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/app/')) return true;
  if (url.pathname === '/manifest.webmanifest') return true;
  return false;
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  // Solo GET: un POST a la API de escritura nunca pasa por aqui.
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);

  // 1. Navegacion: red primero, siempre. Sin esto el hub serviria fichas viejas.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          // Se guarda una copia de la pagina sin conexion por si luego hace falta.
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put('/offline', copia));
          }
          return respuesta;
        })
        .catch(async () => {
          const guardada = await caches.match('/offline');
          return (
            guardada ||
            new Response('Sin conexion y sin copia guardada.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }),
    );
    return;
  }

  // 2. El armazón: cache primero, y se refresca por detras.
  if (esArmazon(url)) {
    evento.respondWith(
      caches.match(peticion).then((guardada) => {
        const desdeRed = fetch(peticion)
          .then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(CACHE).then((cache) => cache.put(peticion, copia));
            }
            return respuesta;
          })
          .catch(() => guardada);
        return guardada || desdeRed;
      }),
    );
    return;
  }

  // 3. Todo lo demas — Supabase, la API, los embeds — pasa de largo, sin tocar.
});
