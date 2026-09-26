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

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    // Portátil real de 1280×720: el tamaño donde la acción de la ficha caía
    // justo bajo el pliegue. Con una ventana alta el fallo no se ve.
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
  }],
  webServer: {
    command: `npm run dev -- --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/wundeer`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
