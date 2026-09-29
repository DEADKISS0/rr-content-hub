# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: idea-editor.spec.ts >> el botón dice qué falta según la pieza
- Location: e2e/idea-editor.spec.ts:25:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'AÑADIR REFERENCIA' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'AÑADIR REFERENCIA' }) with timeout 10000ms
  - waiting for getByRole('button', { name: 'AÑADIR REFERENCIA' })

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  4   | 
  5   | /** Pieza REAL sin referencia: O13, `draft`. */
  6   | const SIN_REFERENCIA = '40e36f4b-645c-4a8c-88ef-37ef3d14b699';
  7   | /** Pieza REAL con referencia: O10. */
  8   | const CON_REFERENCIA = '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
  9   | 
  10  | /**
  11  |  * El editor de una pieza que ya existe.
  12  |  *
  13  |  * Nació del reporte: "la de prueba no tiene referencia y no puedo editarla para
  14  |  * poner el link". Eso era dos huecos a la vez — no había forma de corregir una
  15  |  * idea, y el bloque de referencia se leía como algo finished aunque faltara.
  16  |  *
  17  |  * Lo que se protege, y son tres cosas que se rompen por separado:
  18  |  * 1. El botón DISTINGUE los dos casos y dice cuál. Un editor genérico que no
  19  |  *    dice qué falta repite el mismo reporte disfrazado de "¿cuál es el campo?".
  20  |  * 2. Al editar, la referencia actual viene cargada. Si el campo aparece vacío,
  21  |  *    no sabes qué vas a cambiar: pareces estar borrando algo.
  22  |  * 3. El aviso de error va ARRIBA del formulario y se lee. Este bloque nació del
  23  |  *    reporte "le doy a guardar y no pasa nada".
  24  |  */
  25  | test('el botón dice qué falta según la pieza', async ({ page }) => {
  26  |   await page.addInitScript(visto);
  27  | 
  28  |   await page.goto(`/wundeer/ideas/${SIN_REFERENCIA}`, { waitUntil: 'networkidle' });
> 29  |   await expect(page.getByRole('button', { name: 'AÑADIR REFERENCIA' })).toBeVisible();
      |                                                                         ^ Error: expect(locator).toBeVisible() failed
  30  |   // El aviso lo dice con palabras, no lo deja deducir del hueco.
  31  |   await expect(page.getByText(/le falta la referencia visual/i)).toBeVisible();
  32  |   console.log('[sin referencia] botón "AÑADIR REFERENCIA" + texto que avisa');
  33  | 
  34  |   await page.goto(`/wundeer/ideas/${CON_REFERENCIA}`, { waitUntil: 'networkidle' });
  35  |   await expect(page.getByRole('button', { name: 'EDITAR DATOS' })).toBeVisible();
  36  |   console.log('[con referencia] botón "EDITAR DATOS"');
  37  | });
  38  | 
  39  | test('al editar, la referencia actual viene cargada', async ({ page }) => {
  40  |   await page.addInitScript(visto);
  41  |   await page.goto(`/wundeer/ideas/${CON_REFERENCIA}`, { waitUntil: 'networkidle' });
  42  | 
  43  |   await page.getByRole('button', { name: 'EDITAR DATOS' }).click();
  44  |   const campo = page.locator('#edit-referencia');
  45  |   await expect(campo).toBeVisible();
  46  |   await expect(campo).toHaveAttribute('type', 'url');
  47  | 
  48  |   const valor = await campo.inputValue();
  49  |   console.log(`[campo] "${valor.slice(0, 58)}"`);
  50  |   expect(valor).toContain('drive.google.com');
  51  | 
  52  |   // Y la referencia va antes que el título: es lo que más falta.
  53  |   const orden = await page.evaluate(() => {
  54  |     const y = (sel: string) => {
  55  |       const el = document.querySelector(sel);
  56  |       return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : Infinity;
  57  |     };
  58  |     return { ref: y('#edit-referencia'), titulo: y('#edit-titulo') };
  59  |   });
  60  |   console.log(`[orden] referencia y=${orden.ref}, título y=${orden.titulo}`);
  61  |   expect(orden.ref).toBeLessThan(orden.titulo);
  62  | });
  63  | 
  64  | test('un link roto da un aviso visible arriba', async ({ page }) => {
  65  |   await page.addInitScript(visto);
  66  |   await page.goto(`/wundeer/ideas/${SIN_REFERENCIA}`, { waitUntil: 'networkidle' });
  67  | 
  68  |   await page.getByRole('button', { name: 'AÑADIR REFERENCIA' }).click();
  69  |   await page.locator('#edit-referencia').fill('no-es-un-link');
  70  |   await page.getByRole('button', { name: /GUARDAR CAMBIOS/ }).click();
  71  | 
  72  |   const aviso = page.locator('#aviso-editar');
  73  |   await expect(aviso).toBeVisible({ timeout: 5000 });
  74  |   const texto = (await aviso.textContent()) ?? '';
  75  |   console.log(`[aviso] "${texto.trim()}"`);
  76  |   // Se compara en minúsculas y sin acentos para que la prueba no dependa de la
  77  |   // tilde: lo que importa es que el aviso DIGA que la dirección no vale.
  78  |   //
  79  |   // El texto se contrasta contra lo que el componente DICE de verdad, no contra
  80  |   // una frase inventada en la prueba. La primera versión buscaba "no es una
  81  |   // direccion valida" y el aviso dice "la direccion de la referencia no es
  82  |   // valida": dos palabras de diferencia y la prueba fallaba por eso, no porque
  83  |   // faltara el aviso.
  84  |   const sinAcentos = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  85  |   console.log(`[aviso normalizado] "${sinAcentos.trim()}"`);
  86  |   expect(sinAcentos).toContain('no es valida');
  87  |   expect(sinAcentos).toContain('https://');
  88  | 
  89  |   const arriba = await page.evaluate(() => {
  90  |     const a = document.querySelector('#aviso-editar');
  91  |     const f = document.querySelector('#edit-referencia');
  92  |     if (!a || !f) return false;
  93  |     return a.getBoundingClientRect().top + window.scrollY <
  94  |            f.getBoundingClientRect().top + window.scrollY;
  95  |   });
  96  |   expect(arriba, 'el aviso debe ir ARRIBA del formulario').toBe(true);
  97  | });
  98  | 
  99  | test('el editor se lee en el teléfono', async ({ page }) => {
  100 |   await page.setViewportSize({ width: 390, height: 844 });
  101 |   await page.addInitScript(visto);
  102 |   await page.goto(`/wundeer/ideas/${SIN_REFERENCIA}`, { waitUntil: 'networkidle' });
  103 | 
  104 |   await page.getByRole('button', { name: 'AÑADIR REFERENCIA' }).click();
  105 |   await expect(page.locator('#edit-referencia')).toBeVisible();
  106 | 
  107 |   const desborde = await page.evaluate(
  108 |     () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  109 |   );
  110 |   console.log(`[movil] desborde ${desborde} px`);
  111 |   expect(desborde).toBeLessThanOrEqual(0);
  112 | });
  113 | 
```