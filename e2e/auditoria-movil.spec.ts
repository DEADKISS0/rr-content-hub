import { test, expect } from '@playwright/test';

const FICHA = '27fe6119-b7b6-4409-8aeb-0ae419d574ae'; // O10, estado approved, ref de Drive
const PROYECTO = 'wundeer';
const marcaVisto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

test.describe('auditoría en móvil 390 px', () => {
  test('ficha: un iframe, transiciones vivas, pie con marca', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

    await page.setViewportSize({ width: 390, height: 780 });
    await page.addInitScript(marcaVisto);
    await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    // 1. UN solo iframe: el de la referencia de abajo.
    const iframes = await page.locator('iframe').count();
    // 2. El rótulo del preview duplicado no debe existir.
    const dup = await page.getByText('CÓMO SE VERÁ PUBLICADO').count();
    // 3. Transiciones vivas: O10 está en `approved`, que ofrece INICIAR GUIÓN.
    const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
    const hayGrupo = await grupo.isVisible().catch(() => false);
    const botones = hayGrupo ? (await grupo.getByRole('button').allInnerTexts()).map((t) => t.split('\n')[0]) : [];
    const sinAccion = await page.getByText('SIN ACCIÓN DISPONIBLE').count();

    // 4. Pie con marca, tras hacer scroll al final.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    const pie = page.getByRole('contentinfo');
    const firma = await pie.getByText('Deployed by RR Aliados').isVisible();
    const logo = await pie.getByAltText('RR Aliados').isVisible();

    // 5. Nada debe salirse del ancho del teléfono.
    const desborde = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return [...document.querySelectorAll('main *, footer *')]
        .filter((el) => el.getBoundingClientRect().right > w + 2)
        .slice(0, 5)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`);
    });

    // 6. La acción principal tiene que estar en pantalla, no bajo el pliegue.
    const cta = page.locator('a.btn-brutal[href$="/ideas/nueva"]').first();
    await page.evaluate(() => window.scrollTo(0, 0));
    await cta.waitFor({ state: 'attached' });
    const enPantalla = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }).catch(() => false);

    console.log(JSON.stringify({
      iframes, dup, hayGrupo, botones, sinAccion, firma, logo,
      desborde, ctaEnPantalla: enPantalla, errores: errores.slice(0, 5),
    }, null, 2));

    // Aserciones: estos son los bugs que la auditoría tiene que fijar.
    expect(iframes, 'la referencia no puede aparecer dos veces').toBe(1);
    expect(dup, 'el rótulo del preview duplicado debe estar fuera').toBe(0);
    expect(sinAccion, 'la pieza no puede quedarse sin transiciones').toBe(0);
    expect(botones.length, 'esperaba al menos un movimiento').toBeGreaterThan(0);
    expect(firma).toBe(true);
    expect(logo).toBe(true);
    expect(desborde, 'nada debe salirse de 390 px').toEqual([]);
  });
});
