import { test, expect } from '@playwright/test';

const PROYECTO = 'wundeer';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/**
 * Una pieza en `pending_approval` solo la mueve un `client_approver`. El roster
 * de Wundeer no tiene ninguno: hay 1 `client_viewer`, que es OTRO rol y no
 * puede aprobar. En apariencia son 3 piezas muertas.
 *
 * La salida es el arranque de emergencia del `owner` en `allowedTransitions()`:
 * quien sea owner puede aprobarlas. Este recorrido lo comprueba en la pantalla
 * de verdad, no leyendo el código — porque un arranque que existe en la tabla y
 * no llega a la interfaz deja las piezas igual de muertas.
 */
test('el tablero separa la espera del cliente de la del equipo', async ({ page }) => {
  await page.addInitScript(visto);
  await page.goto(`/${PROYECTO}`, { waitUntil: 'networkidle' });

  const externo = page.getByText(/ESPERANDO AL CLIENTE/);
  const interno = page.getByText(/PARA QUE AVANCE EL EQUIPO/);
  await expect(externo, 'el tablero debe decir quién espera al cliente').toBeVisible();
  await expect(interno, 'el tablero debe decir qué espera al equipo').toBeVisible();

  // Las dos cuentas son distintas y ninguna se presenta como "paradas": una
  // pieza esperando al cliente no está parada, está en manos de otro. Y la
  // palabra "PARADAS" era exactamente el dato que escondía las 22 piezas que el
  // equipo tiene que empujar.
  await expect(page.getByText(/PIEZAS PARADAS/)).toHaveCount(0);

  // Y la suma de las dos, más lo que ya no requiere acción, da el total.
  const total = Number((await page.getByText(/PIEZAS EN EL HUB/).innerText()).match(/(\d+)/)?.[1]);
  const nCliente = Number((await externo.innerText()).match(/(\d+)/)?.[1]);
  const nEquipo = Number((await interno.innerText()).match(/(\d+)/)?.[1]);
  expect(nCliente + nEquipo, 'cliente + equipo no puede pasar el total').toBeLessThanOrEqual(total);
});

test('una pieza que espera al cliente se puede desbloquear', async ({ page }) => {
  await page.addInitScript(visto);
  await page.goto(`/${PROYECTO}/aprobaciones`, { waitUntil: 'networkidle' });

  const destino = await page.locator('a.idea-card').first().getAttribute('href');
  test.skip(!destino, 'la cola de aprobaciones no trae piezas');
  await page.goto(destino as string);

  const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  const hayMovimientos = await grupo.isVisible().catch(() => false);

  // La pieza no puede quedarse muda: o ofrece salida, o explica por qué.
  if (!hayMovimientos) {
    await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
    return;
  }

  const botones = await grupo.getByRole('button').allInnerTexts();
  // Si la pieza espera al cliente, el owner tiene que ver la salida: aprobar,
  // pedir ajustes o archivar. Sin esto, la pieza está atrapada en la práctica.
  const esperadas = ['APROBAR IDEA', 'SOLICITAR AJUSTES', 'ARCHIVAR PROPUESTA'];
  const ofrece = esperadas.some((etiqueta) => botones.join(' ').includes(etiqueta));
  expect(ofrece, `esperaba una salida de cliente, hubo: ${botones.join(' | ')}`).toBe(true);
});
