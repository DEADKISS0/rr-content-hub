import { expect, test, type Page } from '@playwright/test';

/**
 * La votación interna.
 *
 * Por qué este archivo se reescribió: antes apuntaba a una pieza con id fijo
 * (`94ab9361-…`) que ya NO EXISTE (borrada en la limpieza de pruebas), así que
 * el recorrido no votaba sobre nada. Y si esa pieza hubiera seguido existiendo,
 * cada `npx playwright test` habría metido un voto real y, según el conteo,
 * podría haberla movido a `pending_approval`. El propio `playwright.config.ts`
 * afirma que los tests no escriben en la base real; eso era falso, y la idea
 * que quedaba fija en el archivo era justo la prueba.
 *
 * Ahora la pieza se busca por su estado, nunca por id escrito a mano, y el
 * recorrido que ESCRIBE va saltado salvo que se pase `HUB_E2E_VOTAR=1`. La
 * lectura (que el contador y los dos botones están) corre siempre: no muta nada.
 */

const PROYECTO = 'wundeer';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/** La primera pieza que está en votación; '' si no hay ninguna ahora mismo. */
async function primeraEnVotacion(page: Page): Promise<string> {
  await page.goto(`/${PROYECTO}/ideas`);
  const tarjeta = page.locator('a[href*="/ideas/"]').filter({ hasText: /VOTACI/i }).first();
  if (await tarjeta.count()) return (await tarjeta.getAttribute('href')) ?? '';
  const r = await page.request.get(`/api/workspace/list?projectSlug=${PROYECTO}`);
  if (r.ok()) {
    const datos = (await r.json()) as { ideas?: { id: string; status: string }[] };
    const enVotacion = (datos.ideas ?? []).find((i) => i.status === 'voting');
    if (enVotacion) return `/${PROYECTO}/ideas/${enVotacion.id}`;
  }
  return '';
}

test.describe('votación interna', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(visto);
  });

  test('una pieza en voting muestra el contador y los dos botones', async ({ page }) => {
    const href = await primeraEnVotacion(page);
    test.skip(!href, 'no hay ninguna pieza en `voting` ahora mismo: nada que comprobar');

    await page.goto(href);
    await expect(page.getByText(/VOTACI[ÓO]N INTERNA/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /VOTO A FAVOR/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /VOTO EN CONTRA/i })).toBeVisible();
  });

  test('votar de verdad: solo con HUB_E2E_VOTAR=1', async ({ page }) => {
    test.skip(
      !process.env.HUB_E2E_VOTAR,
      'ESCRIBE en rr_hub_votes y puede mover la pieza de estado. Pásale HUB_E2E_VOTAR=1 si lo quieres.',
    );

    const href = await primeraEnVotacion(page);
    test.skip(!href, 'no hay ninguna pieza en `voting`');

    await page.goto(href);
    await page.getByRole('button', { name: /VOTO A FAVOR/i }).click();
    await expect(page.getByRole('status')).toBeVisible();

    // El token del votante es opaco: sin correo, sin nombre.
    const token = await page.evaluate(() => window.localStorage.getItem('rr-hub-votante-v1'));
    expect(token, 'el votante debe tener token').toBeTruthy();
    expect(token!.length, 'un token corto sería predecible').toBeGreaterThan(20);
    expect(token).not.toContain('@');
  });
});
