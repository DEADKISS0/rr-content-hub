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

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE,
    // Solo si alguien la exportó a propósito. Ver la nota de arriba.
    ...(STATE ? { storageState: STATE } : {}),
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    // Portátil real de 1280×720: el tamaño donde la acción de la ficha caía
    // justo bajo el pliegue. Con una ventana alta el fallo no se ve.
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
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
