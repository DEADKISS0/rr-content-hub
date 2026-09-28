import { test, expect } from '@playwright/test';

const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/**
 * Auditoría del panel que cambió en esta ronda.
 *
 * Lo que se protege: que el tablero siga diciendo la verdad en un teléfono. En
 * escritorio las dos esperas caben en columnas; en 390 px se apilan, y ahí es
 * donde se apila también el riesgo de que un número se corte o de que la cifra
 * grande quede pegada al rótulo.
 */
test.describe('tablero en móvil', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('las dos esperas se leen y no se desbordan', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto('/wundeer', { waitUntil: 'networkidle' });

    // Las dos esperas tienen que estar, con su rótulo.
    await expect(page.getByText('ESPERANDO AL CLIENTE')).toBeVisible();
    await expect(page.getByText('PARA QUE AVANCE EL EQUIPO')).toBeVisible();

    // La suma tiene que cubrir todo lo que no está cerrado ni publicado: si
    // aparecen solo las del cliente, el tablero vuelve a mentir.
    const cifras = await page.evaluate(() => {
      const texto = document.body.innerText;
      const num = (etiqueta: string) => {
        const m = texto.match(new RegExp(`(\\d+)\\s*${etiqueta}`));
        return m ? Number(m[1]) : null;
      };
      return {
        piezas: num('PIEZAS EN EL HUB'),
        cliente: num('ESPERANDO AL CLIENTE'),
        equipo: num('PARA QUE AVANCE EL EQUIPO'),
      };
    });

    expect(cifras.cliente).not.toBeNull();
    expect(cifras.equipo).not.toBeNull();

    /**
     * La cuenta NO suma al total: hay piezas en estado terminal (cerrada,
     * publicada) que no esperan a nadie. La suma da 25 sobre 26, y esa pieza es
     * la que está cerrada.
     *
     * Lo que sí tiene que cumplirse es que ninguna pieza esté en las dos
     * columnas a la vez, y que el equipo vea más trabajo pendiente que el
     * cliente: si se invirtieran, la separación no estaría diciendo nada.
     */
    expect(cifras.equipo!).toBeGreaterThan(cifras.cliente!);
    expect(cifras.cliente!).toBeGreaterThan(0);
    expect(cifras.cliente! + cifras.equipo!).toBeLessThanOrEqual(cifras.piezas!);

    // Y el rótulo viejo, ese que decía "paradas", no debe volver.
    await expect(page.getByText(/PIEZAS PARADAS/)).toHaveCount(0);

    // Ningún desborde horizontal: es el fallo móvil más común y no lo pilla el
    // tipo ni el lint.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });

  test('la ficha de una pieza real se lee en móvil', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    await expect(page.getByText('RESPONSABLE DE LA PIEZA')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(1);

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });
});
