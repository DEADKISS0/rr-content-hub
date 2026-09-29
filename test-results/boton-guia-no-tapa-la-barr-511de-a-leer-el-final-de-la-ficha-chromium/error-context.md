# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boton-guia-no-tapa.spec.ts >> la barra de la guía es opaca y deja leer el final de la ficha
- Location: e2e/boton-guia-no-tapa.spec.ts:27:5

# Error details

```
Error: no se encontró el botón de la guía

expect(received).not.toBeNull()

Received: null
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - heading "Acceder al hub" [level=1] [ref=e3]
    - paragraph [ref=e4]: Acceso para el equipo. Tu correo ya está en la lista, no hay que pedirte registro.
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: TU CORREO
        - textbox "TU CORREO" [ref=e8]:
          - /placeholder: tu@email.com
      - generic [ref=e9]:
        - generic [ref=e10]: TU CONTRASEÑA
        - textbox "TU CONTRASEÑA" [ref=e11]
      - button "ENTRAR" [ref=e12]
      - generic [ref=e13]: O CON GOOGLE
      - button "Entrar con Google" [ref=e17]
      - button "¿No recuerdas la contraseña? Recibe un link por correo" [ref=e18]
  - alert [ref=e19]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
  4  | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  5  | 
  6  | /**
  7  |  * La barra de la guía tiene que ser OPACA y dejar leer el final de la ficha.
  8  |  *
  9  |  * La primera versión de esta prueba pedía "cero solapes en todo el scroll", y es
  10 |  * una exigencia IMPOSIBLE: un elemento `fixed` acompaña toda la página, así que
  11 |  * siempre hay un momento en que algo pasa por debajo. Medido: 9 a 14 elementos
  12 |  * bajo el botón en las 20 posiciones revisadas.
  13 |  *
  14 |  * Intentar llegar a cero drive el diseño a esconder la guía en móvil, que es
  15 |  * peor que el defecto: desaparecer una función para que una prueba pase. Por eso
  16 |  * se cambió la exigencia, no el criterio.
  17 |  *
  18 |  * Lo que sí importa, y es lo que se comprueba:
  19 |  *
  20 |  * 1. La barra es opaca. Si el texto se viera a través, eso SÍ es un defecto de
  21 |  *    lectura. Una barra sólida que cubre contenido durante el scroll es lo que
  22 |  *    hace cualquier navegación de móvil.
  23 |  * 2. El contenido tiene `padding-bottom` suficiente para dejar la última línea
  24 |  *    POR ENCIMA de la barra. Sin eso el final de la ficha queda inalcanzable, y
  25 |  *    eso sí es un bug de verdad.
  26 |  */
  27 | test('la barra de la guía es opaca y deja leer el final de la ficha', async ({ page }) => {
  28 |   await page.setViewportSize({ width: 390, height: 844 });
  29 |   await page.addInitScript(visto);
  30 |   await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  31 |   await page.waitForTimeout(1500);
  32 | 
  33 |   const barra = await page.evaluate(() => {
  34 |     const btn = document.querySelector('button[aria-label^="Abrir la guía"]');
  35 |     if (!btn) return null;
  36 |     const r = btn.getBoundingClientRect();
  37 |     const cs = getComputedStyle(btn);
  38 |     return {
  39 |       ancho: Math.round(r.width),
  40 |       alto: Math.round(r.height),
  41 |       fondo: cs.backgroundColor,
  42 |       opaco: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent',
  43 |     };
  44 |   });
  45 | 
> 46 |   expect(barra, 'no se encontró el botón de la guía').not.toBeNull();
     |                                                           ^ Error: no se encontró el botón de la guía
  47 |   if (!barra) return;
  48 | 
  49 |   console.log(`[barra] ${barra.ancho}x${barra.alto} fondo ${barra.fondo} opaca ${barra.opaco}`);
  50 |   expect(barra.opaco, 'la barra de la guía es transparente: el texto se ve a través').toBe(true);
  51 | 
  52 |   const final = await page.evaluate(
  53 |     () =>
  54 |       new Promise<{ tapado: boolean; margen: number; barra: number }>((resolve) => {
  55 |         window.scrollTo(0, document.documentElement.scrollHeight);
  56 |         setTimeout(() => {
  57 |           const btn = document.querySelector('button[aria-label^="Abrir la guía"]')!;
  58 |           const barra = btn.getBoundingClientRect();
  59 | 
  60 |           // El último texto de la ficha, medido por posición real. Se excluye
  61 |           // el pie: `HubFooter` está FUERA del contenedor con `pb-20`, y es
  62 |           // texto institucional que no se pierde por estar bajo la barra.
  63 |           const masAbajo = [...document.querySelectorAll('main p, main dd, main h2, main h3, main li')]
  64 |             .filter((el) => (el.textContent ?? '').trim().length > 0)
  65 |             .map((el) => el.getBoundingClientRect())
  66 |             .filter((r) => r.height > 0)
  67 |             .reduce((a, b) => (b.bottom > a.bottom ? b : a));
  68 | 
  69 |           resolve({
  70 |             tapado: masAbajo.bottom > barra.top,
  71 |             margen: Math.round(barra.top - masAbajo.bottom),
  72 |             barra: Math.round(barra.top),
  73 |           });
  74 |         }, 400);
  75 |       })
  76 |   );
  77 | 
  78 |   console.log(`[final] barra en y=${final.barra}, margen libre ${final.margen} px`);
  79 |   expect(
  80 |     final.tapado,
  81 |     `el final de la ficha queda tapado por la barra (margen ${final.margen} px)`
  82 |   ).toBe(false);
  83 |   expect(final.margen).toBeGreaterThanOrEqual(0);
  84 | });
  85 | 
```