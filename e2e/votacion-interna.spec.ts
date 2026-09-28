import { test, expect } from '@playwright/test';

const IDEA = '94ab9361-1945-4a72-93c6-1fc1a8fc7c96';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/** Pieza real en `voting`: la que el generador dejaria en esa fase. */
test.describe('votacion interna', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(visto);
  });

  test('la ficha muestra el contador y los dos botones', async ({ page }) => {
    await page.goto(`/wundeer/ideas/${IDEA}`);
    await expect(page.getByText('VOTACIÓN INTERNA')).toBeVisible();
    await expect(page.getByRole('button', { name: /VOTO A FAVOR/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /VOTO EN CONTRA/i })).toBeVisible();
    console.log('[inicio] contador visible con los dos botones');
  });

  test('el token del votante se genera una vez y se guarda', async ({ page }) => {
    await page.goto(`/wundeer/ideas/${IDEA}`);
    await page.getByRole('button', { name: /VOTO A FAVOR/i }).click();
    await expect(page.getByRole('status')).toBeVisible();
    const token = await page.evaluate(() => window.localStorage.getItem('rr-hub-votante-v1'));
    console.log(`[token] ${token ? 'generado, ' + token.length + ' caracteres' : 'NO se genero'}`);
    expect(token, 'el votante debe tener token').toBeTruthy();
    expect(token!.length, 'un token corto seria predecible').toBeGreaterThan(20);
    // Ni email ni nombre: solo un valor opaco.
    expect(token).not.toContain('@');
  });
});
