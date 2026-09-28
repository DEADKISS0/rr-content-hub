import { test, expect } from '@playwright/test';

const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/**
 * El reordenamiento de la ficha: la referencia sube, la acción se pega al estado.
 *
 * El riesgo real de este cambio no es que se vea feo: es que la única acción de
 * la ficha vuelva a caer bajo el pliegue. Ya pasó una vez (y≈736 en un portátil
 * de 720 px) y lo cazó un recorrido, no una mirada.
 */
test.describe('ficha reordenada', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('la acción y la referencia se ven sin hacer scroll', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    // 1. La acción existe y es alcanzable: eso es lo que no puede romperse.
    const accion = page.locator('[data-guia="accion"]');
    await expect(accion).toBeVisible();
    await expect(accion).toBeInViewport();

    // 2. La referencia es la segunda cosa, no la última: sube a la cabecera.
    const ref = page.locator('[data-guia="brief"]');
    await expect(ref).toHaveCount(1);
    const orden = await page.evaluate(() => {
      const y = (s: string) => {
        const el = document.querySelector(s);
        return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1;
      };
      return { accion: y('[data-guia="accion"]'), ref: y('[data-guia="brief"]') };
    });
    // La referencia va DESPUÉS de la acción y del título, pero no al final de
    // la ficha: estaba en y=1437 con el bloque al fondo. Subió a la cabecera.
    expect(orden.accion).toBeLessThan(orden.ref);
    expect(orden.ref).toBeLessThan(1400);

    // 3. Un solo iframe. El bloque se movió de sitio; duplicarlo sería el
    //    defecto que ya se corrigió una vez.
    await expect(page.locator('iframe')).toHaveCount(1);
  });

  test('el encuadre se adapta al formato y no desperdicia ancho', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    const marco = await page.evaluate(() => {
      const f = document.querySelector('iframe') as HTMLIFrameElement | null;
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { ancho: Math.round(r.width), alto: Math.round(r.height) };
    });
    expect(marco).not.toBeNull();
    if (marco) {
      const ratio = marco.ancho / marco.alto;
      console.log(`[marco] ${marco.ancho}x${marco.alto} ratio ${ratio.toFixed(2)}`);
      // Antes era 276x480 = 0.57. Un marco "normal" está entre 0.6 y 2.2.
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(2.2);
    }
  });
});

test.describe('en el teléfono', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la referencia no se come la pantalla', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    const marco = await page.evaluate(() => {
      const f = document.querySelector('iframe') as HTMLIFrameElement | null;
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return {
        alto: Math.round(r.height),
        ventana: window.innerHeight,
        ancho: Math.round(r.width),
        anchoPantalla: document.documentElement.clientWidth,
      };
    });
    expect(marco).not.toBeNull();
    if (marco) {
      console.log(`[movil] iframe ${marco.ancho}x${marco.alto} en pantalla de ${marco.anchoPantalla}`);
      // Antes ocupaba el 40% de la pantalla. Ahora no debe pasar de un tercio.
      expect(marco.alto / marco.ventana).toBeLessThan(0.34);
      // Y no debe desbordar: el marco angosto no se sale de la tarjeta.
      expect(marco.ancho).toBeLessThanOrEqual(marco.anchoPantalla);
    }

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });
});
