# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tablero-movil.spec.ts >> tablero en móvil >> la ficha de una pieza real se lee en móvil
- Location: e2e/tablero-movil.spec.ts:67:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('RESPONSABLE DE LA PIEZA')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('RESPONSABLE DE LA PIEZA') with timeout 10000ms
  - waiting for getByText('RESPONSABLE DE LA PIEZA')

```

```yaml
- main:
  - heading "Acceder al hub" [level=1]
  - paragraph: El código del cliente y tu nombre. Sin correos ni contraseñas.
  - group "// CÓDIGO DEL CLIENTE":
    - text: // CÓDIGO DEL CLIENTE
    - textbox "Dígito 1 de 4"
    - textbox "Dígito 2 de 4"
    - textbox "Dígito 3 de 4"
    - textbox "Dígito 4 de 4"
  - button "CONTINUAR"
  - paragraph: // CÓDIGOS
  - list:
    - listitem: WUNDEER · 1111
    - listitem: CANDILEJAS · 2222
  - paragraph: El código abre el cliente. Lo que puedes hacer dentro lo decide tu rol, y ese no cambia con el código.
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
  4  | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  5  | 
  6  | /**
  7  |  * Auditoría del panel que cambió en esta ronda.
  8  |  *
  9  |  * Lo que se protege: que el tablero siga diciendo la verdad en un teléfono. En
  10 |  * escritorio las dos esperas caben en columnas; en 390 px se apilan, y ahí es
  11 |  * donde se apila también el riesgo de que un número se corte o de que la cifra
  12 |  * grande quede pegada al rótulo.
  13 |  */
  14 | test.describe('tablero en móvil', () => {
  15 |   test.use({ viewport: { width: 390, height: 844 } });
  16 | 
  17 |   test('las dos esperas se leen y no se desbordan', async ({ page }) => {
  18 |     await page.addInitScript(visto);
  19 |     await page.goto('/wundeer', { waitUntil: 'networkidle' });
  20 | 
  21 |     // Las dos esperas tienen que estar, con su rótulo.
  22 |     await expect(page.getByText('ESPERANDO AL CLIENTE')).toBeVisible();
  23 |     await expect(page.getByText('PARA QUE AVANCE EL EQUIPO')).toBeVisible();
  24 | 
  25 |     // La suma tiene que cubrir todo lo que no está cerrado ni publicado: si
  26 |     // aparecen solo las del cliente, el tablero vuelve a mentir.
  27 |     const cifras = await page.evaluate(() => {
  28 |       const texto = document.body.innerText;
  29 |       const num = (etiqueta: string) => {
  30 |         const m = texto.match(new RegExp(`(\\d+)\\s*${etiqueta}`));
  31 |         return m ? Number(m[1]) : null;
  32 |       };
  33 |       return {
  34 |         piezas: num('PIEZAS EN EL HUB'),
  35 |         cliente: num('ESPERANDO AL CLIENTE'),
  36 |         equipo: num('PARA QUE AVANCE EL EQUIPO'),
  37 |       };
  38 |     });
  39 | 
  40 |     expect(cifras.cliente).not.toBeNull();
  41 |     expect(cifras.equipo).not.toBeNull();
  42 | 
  43 |     /**
  44 |      * La cuenta NO suma al total: hay piezas en estado terminal (cerrada,
  45 |      * publicada) que no esperan a nadie. La suma da 25 sobre 26, y esa pieza es
  46 |      * la que está cerrada.
  47 |      *
  48 |      * Lo que sí tiene que cumplirse es que ninguna pieza esté en las dos
  49 |      * columnas a la vez, y que el equipo vea más trabajo pendiente que el
  50 |      * cliente: si se invirtieran, la separación no estaría diciendo nada.
  51 |      */
  52 |     expect(cifras.equipo!).toBeGreaterThan(cifras.cliente!);
  53 |     expect(cifras.cliente!).toBeGreaterThan(0);
  54 |     expect(cifras.cliente! + cifras.equipo!).toBeLessThanOrEqual(cifras.piezas!);
  55 | 
  56 |     // Y el rótulo viejo, ese que decía "paradas", no debe volver.
  57 |     await expect(page.getByText(/PIEZAS PARADAS/)).toHaveCount(0);
  58 | 
  59 |     // Ningún desborde horizontal: es el fallo móvil más común y no lo pilla el
  60 |     // tipo ni el lint.
  61 |     const desborde = await page.evaluate(
  62 |       () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  63 |     );
  64 |     expect(desborde).toBeLessThanOrEqual(0);
  65 |   });
  66 | 
  67 |   test('la ficha de una pieza real se lee en móvil', async ({ page }) => {
  68 |     await page.addInitScript(visto);
  69 |     await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  70 | 
> 71 |     await expect(page.getByText('RESPONSABLE DE LA PIEZA')).toBeVisible();
     |                                                             ^ Error: expect(locator).toBeVisible() failed
  72 |     await expect(page.locator('iframe')).toHaveCount(1);
  73 | 
  74 |     const desborde = await page.evaluate(
  75 |       () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  76 |     );
  77 |     expect(desborde).toBeLessThanOrEqual(0);
  78 |   });
  79 | });
  80 | 
```