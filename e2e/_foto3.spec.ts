import { test } from '@playwright/test';

const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
const SALIDA = '/home/deadkiss/.hermes/cache/scratch';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/** Foto final del resultado, ya en producción. */
test('foto final', async ({ page }) => {
  await page.addInitScript(visto);
  await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SALIDA}/final-arriba.png` });

  await page.locator('iframe').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SALIDA}/final-ref.png` });

  const d = await page.evaluate(() => {
    const r = document.querySelector('iframe')!.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), v: window.innerHeight };
  });
  console.log(`[escritorio] iframe ${d.w}x${d.h} (antes 276x480)`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.locator('iframe').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SALIDA}/final-movil.png` });

  const m = await page.evaluate(() => {
    const r = document.querySelector('iframe')!.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), v: window.innerHeight };
  });
  console.log(`[movil] iframe ${m.w}x${m.h} = ${Math.round((m.h / m.v) * 100)}% de pantalla (antes 40%)`);

  // La acción tiene que estar en la primera pantalla en el teléfono también.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const btn = await page.evaluate(() => {
    const b = document.querySelector('[data-guia="accion"] button:not([disabled])');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { top: Math.round(r.top), v: window.innerHeight, txt: b.textContent?.trim().slice(0, 24) };
  });
  console.log(`[movil] boton "${btn?.txt}" en y=${btn?.top}, ventana ${btn?.v}`);
  console.log(`[movil] se ve sin scroll: ${btn && btn.top < btn.v ? 'SI' : 'NO'}`);
});
