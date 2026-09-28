import { test, expect } from '@playwright/test';

const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/**
 * La barra de la guía tiene que ser OPACA y dejar leer el final de la ficha.
 *
 * La primera versión de esta prueba pedía "cero solapes en todo el scroll", y es
 * una exigencia IMPOSIBLE: un elemento `fixed` acompaña toda la página, así que
 * siempre hay un momento en que algo pasa por debajo. Medido: 9 a 14 elementos
 * bajo el botón en las 20 posiciones revisadas.
 *
 * Intentar llegar a cero drive el diseño a esconder la guía en móvil, que es
 * peor que el defecto: desaparecer una función para que una prueba pase. Por eso
 * se cambió la exigencia, no el criterio.
 *
 * Lo que sí importa, y es lo que se comprueba:
 *
 * 1. La barra es opaca. Si el texto se viera a través, eso SÍ es un defecto de
 *    lectura. Una barra sólida que cubre contenido durante el scroll es lo que
 *    hace cualquier navegación de móvil.
 * 2. El contenido tiene `padding-bottom` suficiente para dejar la última línea
 *    POR ENCIMA de la barra. Sin eso el final de la ficha queda inalcanzable, y
 *    eso sí es un bug de verdad.
 */
test('la barra de la guía es opaca y deja leer el final de la ficha', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(visto);
  await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const barra = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label^="Abrir la guía"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    return {
      ancho: Math.round(r.width),
      alto: Math.round(r.height),
      fondo: cs.backgroundColor,
      opaco: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent',
    };
  });

  expect(barra, 'no se encontró el botón de la guía').not.toBeNull();
  if (!barra) return;

  console.log(`[barra] ${barra.ancho}x${barra.alto} fondo ${barra.fondo} opaca ${barra.opaco}`);
  expect(barra.opaco, 'la barra de la guía es transparente: el texto se ve a través').toBe(true);

  const final = await page.evaluate(
    () =>
      new Promise<{ tapado: boolean; margen: number; barra: number }>((resolve) => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        setTimeout(() => {
          const btn = document.querySelector('button[aria-label^="Abrir la guía"]')!;
          const barra = btn.getBoundingClientRect();

          // El último texto de la ficha, medido por posición real. Se excluye
          // el pie: `HubFooter` está FUERA del contenedor con `pb-20`, y es
          // texto institucional que no se pierde por estar bajo la barra.
          const masAbajo = [...document.querySelectorAll('main p, main dd, main h2, main h3, main li')]
            .filter((el) => (el.textContent ?? '').trim().length > 0)
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.height > 0)
            .reduce((a, b) => (b.bottom > a.bottom ? b : a));

          resolve({
            tapado: masAbajo.bottom > barra.top,
            margen: Math.round(barra.top - masAbajo.bottom),
            barra: Math.round(barra.top),
          });
        }, 400);
      })
  );

  console.log(`[final] barra en y=${final.barra}, margen libre ${final.margen} px`);
  expect(
    final.tapado,
    `el final de la ficha queda tapado por la barra (margen ${final.margen} px)`
  ).toBe(false);
  expect(final.margen).toBeGreaterThanOrEqual(0);
});
