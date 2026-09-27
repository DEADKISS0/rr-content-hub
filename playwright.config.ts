import { defineConfig, devices } from '@playwright/test';

/**
 * Recorridos de punta a punta, SIEMPRE de lectura.
 *
 * No escriben en la base real: el hub corre contra el Supabase de producción y
 * una prueba que mueva una pieza estaría tocando datos de clientes. Lo que se
 * verifica aquí son las invariantes visibles (una sola acción por superficie,
 * la cola ordenada por urgencia, el roadmap sin barras clonadas, los avisos
 * honestos), que es justo lo que se rompió y nadie vio.
 *
 * El servidor lo reutiliza si ya está levantado: no arranca uno nuevo por gusto.
 * El puerto se puede mover con HUB_E2E_PORT: en esta máquina hay otras ventanas
 * con sus propios dev servers y el 3100 se ocupa solo.
 */
const PUERTO = process.env.HUB_E2E_PORT ?? '3100';

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
