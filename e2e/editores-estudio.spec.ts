import { expect, test } from '@playwright/test';

const PROYECTOS = ['wundeer', 'satiro', 'boga'];

test.describe('Estudio · editores profesionales', () => {
  test.setTimeout(120_000);

  test('cada proyecto redirige foto y video a las aplicaciones profesionales', async ({ page }) => {
    for (const proyecto of PROYECTOS) {
      await page.goto(`/${proyecto}/editar/foto`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/editors\/rr-imagen\/index\.html$/);

      await page.goto(`/${proyecto}/editar/video`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/editors\/rr-motion\/index\.html$/);
    }

    const inexistente = await page.goto('/proyecto-inexistente/editar/foto', { waitUntil: 'domcontentloaded' });
    expect(inexistente?.status()).toBe(404);
  });

  test('los botones del menú Estudio llegan a los editores y ambos arrancan', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });

    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /EDITAR FOTO/ }).click();
    await expect(page).toHaveURL(/\/editors\/rr-imagen\/index\.html$/);
    await expect(page).toHaveTitle('RR Imagen');
    await expect(page.locator('#photocraft_loading')).toBeHidden({ timeout: 45_000 });

    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /EDITAR VIDEO/ }).click();
    await expect(page).toHaveURL(/\/editors\/rr-motion\/index\.html$/);
    await expect(page).toHaveTitle('RR Motion');
    await page.waitForFunction(() => Boolean((window as unknown as { filmcraftLoad?: { readyMs?: number } }).filmcraftLoad?.readyMs), null, { timeout: 45_000 });

    expect(errores.filter((mensaje) => /Content Security Policy|WebAssembly|failed to fetch/i.test(mensaje))).toEqual([]);
  });

  test('al anticipar el clic se precarga el WASM del editor', async ({ page }) => {
    const pedidos: string[] = [];
    page.on('request', (peticion) => {
      if (/\.wasm/.test(peticion.url())) pedidos.push(peticion.url());
    });

    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /EDITAR FOTO/ }).hover();
    await expect.poll(() => pedidos.some((url) => url.includes('rr-imagen'))).toBe(true);

    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /EDITAR VIDEO/ }).hover();
    await expect.poll(() => pedidos.some((url) => url.includes('filmcraft_web_bg.wasm'))).toBe(true);
  });
});
