import { expect, test } from '@playwright/test';

/**
 * NX-1028 paso 4 — recorridos del Plan de publicación.
 *
 * La matriz de acceso del paso 3 cambió la puerta de esta página: sin sesión
 * `/wundeer/redes` ya no pinta el plan, pinta «Sin acceso» y la API responde
 * 401. Por eso los recorridos se parten en dos:
 *
 *   · El del VISITANTE corre SIEMPRE: es el criterio «visitante sin acceso»
 *     medido contra un servidor real, y es la única rama que este entorno puede
 *     verificar en vivo (no hay cuenta de prueba con fila en rr_hub_access).
 *   · Los tres que necesitan el plan abierto se SALTAN con el motivo escrito
 *     si no hay `HUB_E2E_STATE` (playwright.config.ts aplica ese storageState).
 *     Verde sin mentir: dice por qué no corrió en vez de fallar con un
 *     «Sin acceso» que el test interpretaría como producto roto.
 */
const ruta = '/wundeer/redes';
const base = process.env.HUB_BASE_URL ?? `http://localhost:${process.env.HUB_E2E_PORT ?? '3100'}`;
const estadoVisitante = {
  cookies: [],
  origins: [{
    origin: new URL(base).origin,
    localStorage: [{ name: 'rr-hub-guia-v1', value: 'visto' }],
  }],
};

test.describe('visitante sin sesión', () => {
  // Cuando HUB_E2E_STATE está definido, Playwright aplica la sesión del owner a
  // todo el proyecto. Estos dos recorridos miden lo contrario, así que vacían
  // la cookie explícitamente en vez de heredar una identidad y dar un rojo falso.
  test.use({ storageState: estadoVisitante });

  test('el visitante sin sesión no ve el plan: pantalla «Sin acceso» y API en 401', async ({ page, baseURL }) => {
    const api = await page.request.get(`${baseURL}/api/social-plan?proyecto=wundeer`);
    expect(api.status(), 'GET del plan sin sesión').toBe(401);

    await page.goto(ruta, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('sin-acceso')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Editor de contenido organico' })).toHaveCount(0);
  });

  test('la pantalla de «Sin acceso» no se desborda en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ruta, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('sin-acceso')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('el plan abierto (requiere sesión)', () => {
  test.beforeEach(() => {
    // Sin storageState la página respondería «Sin acceso» y los tres
    // recorridos medirían la pantalla equivocada.
    test.skip(
      !process.env.HUB_E2E_STATE,
      'hace falta HUB_E2E_STATE (storageState de una persona con acceso) para ver el plan con sesión',
    );
  });

  test('el formulario social empieza por contenido y portada, sin pedir titulo', async ({ page }) => {
    await page.goto(ruta, { waitUntil: 'networkidle' });
    const editor = page.getByRole('region', { name: 'Editor de contenido organico' });
    const etiquetas = await editor.locator('label > span:first-child').allTextContents();
    expect(etiquetas.slice(0, 2)).toEqual([
      'URL del contenido o carpeta de Drive',
      'URL de portada',
    ]);
    await expect(editor.getByText('Titulo editable')).toHaveCount(0);
  });

  test('pedir cambios exige y guarda un comentario visible', async ({ page }) => {
    await page.goto(ruta, { waitUntil: 'networkidle' });
    const editor = page.getByRole('region', { name: 'Editor de contenido organico' });
    await editor.getByRole('button', { name: 'Pedir cambios' }).click();
    const comentario = editor.getByLabel('Comentario del cambio');
    await expect(comentario).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Confirmar solicitud' })).toBeDisabled();
    await comentario.fill('Usar una portada donde se vea la prenda completa.');
    await editor.getByRole('button', { name: 'Confirmar solicitud' }).click();
    await expect(editor.getByText('Cambios solicitados')).toBeVisible();
    await expect(editor.getByText('Usar una portada donde se vea la prenda completa.')).toBeVisible();
  });

  test('la pauta tiene mock propio y no hay desborde movil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ruta, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Pauta publicitaria' })).toBeVisible();
    await expect(page.getByText('Patrocinado').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comprar ahora' }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
