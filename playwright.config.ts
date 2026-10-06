import { defineConfig, devices } from '@playwright/test';

/**
 * Recorridos de punta a punta.
 *
 * Lo que este archivo afirmaba antes, y era falso: "siempre de lectura, no
 * escriben en la base real". Dos recorridos pulsaban VOTO A FAVOR y GUARDAR
 * sobre piezas reales; con el hub apuntando a producción, cada
 * `npx playwright test` movía el estado de una pieza de Wundeer. Ahora lo que
 * ESCRIBE pide una variable explícita —ver `votacion-interna.spec.ts` y
 * `idea-editor.spec.ts`— y lo que solo LEE corre siempre.
 *
 * Y el problema inverso, que llegó después: al encender la autenticación, las
 * páginas del hub pasaron a pedir sesión y los recorridos se ejecutaron sin
 * notion de ella. 38 de 42 dejaron de informar: la puerta redirigía a /login y
 * el selector nunca aparecía. Un rojo que dice "el producto está roto" cuando
 * en realidad dice "el test no sabe entrar" es peor que no tener la prueba.
 *
 * Aquí no se arregla con un `storageState` comiteado: las cuentas del equipo no
 * están en el repo y las claves no se inventan. Entonces lo que se hace es
 * decirlo:
 *
 *   · Sin sesión, lo que necesita sesión se SALTA con el motivo escrito. Verde,
 *     pero sin mentir sobre qué se probó.
 *   · Con `HUB_E2E_STATE` apuntando a un storageState exportado por una persona
 *     con acceso, corre entero.
 *
 * `storageState` nunca se pone por defecto: un archivo de sesión en el repo es
 * una sesión de producción versionada.
 */
const PUERTO = process.env.HUB_E2E_PORT ?? '3100';
const STATE = process.env.HUB_E2E_STATE;

/**
 * `HUB_BASE_URL` corre los recorridos contra un build ya desplegado en vez del
 * dev server — el caso que importa cuando lo que se acaba de subir a `main` es
 * un cambio de SERVIDOR (una acción nueva en `/api/workspace`), no de estilos.
 *
 * Importa porque el dev server corre sin `SUPABASE_SERVICE_ROLE_KEY`: cualquier
 * ruta que use el cliente `service` devuelve 500 ahí y pasa en local, mientras
 * en producción responde bien. La acción `roster` fue exactamente ese caso — el
 * e2e en local veía un roster vacío y en producción devuelve 16 personas.
 */
const BASE = process.env.HUB_BASE_URL ?? `http://localhost:${PUERTO}`;

/**
 * `storageState` que marca la guía guiada como ya vista, para el `origin` del
 * sitio al que se está entrando. (2026-10-05)
 *
 * La clave y el valor son los de `guided-tour.tsx`: `rr-hub-guia-v1` = `visto`.
 * Sin esto la guía se abre en cada contexto limpio, su overlay
 * `position: fixed` se come los clics y la mitad de los recorridos de lectura
 * fallan por eso y no por lo que miden.
 *
 * Se exporta como función y no como constante porque `origin` depende de
 * `BASE`, que cambia con `HUB_BASE_URL`.
 */
const guiaMarcadaComoVista = (base: string) => ({
  cookies: [],
  origins: [{
    origin: new URL(base).origin,
    localStorage: [{ name: 'rr-hub-guia-v1', value: 'visto' }],
  }],
});

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  // MEDIDO 2026-10-05: la guía guiada sale en cada contexto NUEVO y su overlay
  // `fixed inset-0 z-50` se come los clics. Con dos workers, cada uno abre su
  // contexto limpio y recibe la guía, así que la mitad de los recorridos de
  // lectura fallaban por eso y no por lo que median.
  //
  // Se resuelve antes de los workers, no en cada recorrido: `storageState` vacío
  // + la guía marcada como vista. El aviso del selector de perfil usa la misma
  // marca (`rr-hub:aviso-perfil-visto`), así que el popup de configuración deja
  // de salir en E2E —que es lo que se quiere, porque hay un recorrido que lo
  // comprueba y para eso se abre con `addInitScript`.
  use: {
    baseURL: BASE,
    ...(STATE ? { storageState: STATE } : {}),
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // Portátil real de 1280×720: el tamaño donde la acción de la ficha caía
      // justo bajo el pliegue. Con una ventana alta el fallo no se ve.
      viewport: { width: 1280, height: 720 },
      // MEDIDO 2026-10-05: el overlay de la guía es `position: fixed`, así que
      // `hiding` no lo saca de la cadena de eventos; Playwright igual lo reporta
      // como intercepting. Se marca la guía como vista ANTES de cargar, con la
      // clave REAL de `guided-tour.tsx`: `rr-hub-guia-v1` = `visto`. La 1a
      // versión puso `rr-hub:guia-vista` y no cerraba nada, porque esa clave no
      // existe — un nombre inventado que se lee bien y no hace nada.
      //
      // El `origin` sale de `BASE` y NO de una constante: medido el 2026-10-05,
      // con `HUB_BASE_URL` sin exportar el `origin` era
      // `http://localhost:3100` aunque el recorrido corriera contra producción, y
      // `localStorage` de un origen no se ve desde otro. La guía abría y se
      // comía los clics en la mitad de los recorridos. Un `storageState` con el
      // origen equivocado no da error: no hace nada.
      storageState: STATE ? undefined : guiaMarcadaComoVista(BASE),
    },
  }],
  // Con `HUB_BASE_URL` no hay servidor local que levantar: el destino ya está
  // desplegado y arrancarlo sería arrancar un segundo sitio con otro código.
  ...(process.env.HUB_BASE_URL ? {} : {
    webServer: {
      command: `npm run dev -- --port ${PUERTO}`,
      url: `http://localhost:${PUERTO}/wundeer`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),
});
