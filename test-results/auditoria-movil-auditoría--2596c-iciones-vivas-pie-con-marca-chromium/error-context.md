# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auditoria-movil.spec.ts >> auditoría en móvil 390 px >> ficha: un iframe, transiciones vivas, pie con marca
- Location: e2e/auditoria-movil.spec.ts:8:7

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 45000ms exceeded.
Call log:
  - waiting for locator('a.btn-brutal[href$="/ideas/nueva"]').first()

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
  4  | const PROYECTO = 'wundeer';
  5  | const marcaVisto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  6  | 
  7  | test.describe('auditoría en móvil 390 px', () => {
  8  |   test('ficha: un iframe, transiciones vivas, pie con marca', async ({ page }) => {
  9  |     const errores: string[] = [];
  10 |     page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  11 | 
  12 |     await page.setViewportSize({ width: 390, height: 780 });
  13 |     await page.addInitScript(marcaVisto);
  14 |     await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  15 | 
  16 |     // 1. UN solo iframe: el de la referencia de abajo.
  17 |     const iframes = await page.locator('iframe').count();
  18 |     // 2. El rótulo del preview duplicado no debe existir.
  19 |     const dup = await page.getByText('CÓMO SE VERÁ PUBLICADO').count();
  20 |     // 3. Transiciones vivas: O10 está en `approved`, que ofrece INICIAR GUIÓN.
  21 |     const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  22 |     const hayGrupo = await grupo.isVisible().catch(() => false);
  23 |     const botones = hayGrupo ? (await grupo.getByRole('button').allInnerTexts()).map((t) => t.split('\n')[0]) : [];
  24 |     const sinAccion = await page.getByText('SIN ACCIÓN DISPONIBLE').count();
  25 | 
  26 |     // 4. Pie con marca, tras hacer scroll al final.
  27 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  28 |     await page.waitForTimeout(400);
  29 |     const pie = page.getByRole('contentinfo');
  30 |     const firma = await pie.getByText('Deployed by RR Aliados').isVisible();
  31 |     const logo = await pie.getByAltText('RR Aliados').isVisible();
  32 | 
  33 |     // 5. Nada debe salirse del ancho del teléfono.
  34 |     const desborde = await page.evaluate(() => {
  35 |       const w = document.documentElement.clientWidth;
  36 |       return [...document.querySelectorAll('main *, footer *')]
  37 |         .filter((el) => el.getBoundingClientRect().right > w + 2)
  38 |         .slice(0, 5)
  39 |         .map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`);
  40 |     });
  41 | 
  42 |     // 6. La acción principal tiene que estar en pantalla, no bajo el pliegue.
  43 |     const cta = page.locator('a.btn-brutal[href$="/ideas/nueva"]').first();
  44 |     await page.evaluate(() => window.scrollTo(0, 0));
> 45 |     await cta.waitFor({ state: 'attached' });
     |               ^ Error: locator.waitFor: Test timeout of 45000ms exceeded.
  46 |     const enPantalla = await cta.evaluate((el) => {
  47 |       const r = el.getBoundingClientRect();
  48 |       return r.top < window.innerHeight && r.bottom > 0;
  49 |     }).catch(() => false);
  50 | 
  51 |     console.log(JSON.stringify({
  52 |       iframes, dup, hayGrupo, botones, sinAccion, firma, logo,
  53 |       desborde, ctaEnPantalla: enPantalla, errores: errores.slice(0, 5),
  54 |     }, null, 2));
  55 | 
  56 |     // Aserciones: estos son los bugs que la auditoría tiene que fijar.
  57 |     expect(iframes, 'la referencia no puede aparecer dos veces').toBe(1);
  58 |     expect(dup, 'el rótulo del preview duplicado debe estar fuera').toBe(0);
  59 |     expect(sinAccion, 'la pieza no puede quedarse sin transiciones').toBe(0);
  60 |     expect(botones.length, 'esperaba al menos un movimiento').toBeGreaterThan(0);
  61 |     expect(firma).toBe(true);
  62 |     expect(logo).toBe(true);
  63 |     expect(desborde, 'nada debe salirse de 390 px').toEqual([]);
  64 |   });
  65 | });
  66 | 
```