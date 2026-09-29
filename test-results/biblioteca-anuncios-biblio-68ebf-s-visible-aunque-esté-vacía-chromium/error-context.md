# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: biblioteca-anuncios.spec.ts >> biblioteca de anuncios en el alta >> la zona de la biblioteca es visible aunque esté vacía
- Location: e2e/biblioteca-anuncios.spec.ts:30:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /BIBLIOTECA DE ANUNCIOS|ELEGIR UN ANUNCIO DE LA BIBLIOTECA/i }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /BIBLIOTECA DE ANUNCIOS|ELEGIR UN ANUNCIO DE LA BIBLIOTECA/i }).first() with timeout 10000ms
  - waiting for getByRole('button', { name: /BIBLIOTECA DE ANUNCIOS|ELEGIR UN ANUNCIO DE LA BIBLIOTECA/i }).first()

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
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * La biblioteca de anuncios, conectada al alta de ideas.
  5  |  *
  6  |  * Qué se protege aquí, y por qué esta prueba existe:
  7  |  *
  8  |  * La biblioteca se armó en la base pero el componente que la mostraba se perdió
  9  |  * (quedó solo en un stash de otra sesión). La columna `ad_id` sí sobrevivió, y
  10 |  * por eso era peligroso: el sistema parecía completo y no lo estaba.
  11 |  *
  12 |  * Las reglas que se comprueban, en orden de importancia:
  13 |  *   1. La zona de la biblioteca SIEMPRE es visible. Ni con lista vacía: un
  14 |  *      botón que desaparece sin explicar por qué se lee como función rota, y la
  15 |  *      primera causa fue RLS devolviendo 0 filas en silencio.
  16 |  *   2. Con anuncios, se abre y busca.
  17 |  *   3. Al elegir, se rellena la REFERENCIA (lo que se fue a buscar).
  18 |  *   4. Al elegir, NO se pisa el título si la persona ya escribió uno. Un
  19 |  *      selector que pisa lo escrito es un selector que nadie usa dos veces.
  20 |  *
  21 |  * Solo lectura: no guarda la idea, así que no deja basura. El guardado con
  22 |  * `ad_id` se cubre en `hub.spec.ts`, que sí crea y borra.
  23 |  */
  24 | 
  25 | const PROYECTO = 'wundeer';
  26 | const BOTON_BIBLIOTECA = /BIBLIOTECA DE ANUNCIOS|ELEGIR UN ANUNCIO DE LA BIBLIOTECA/i;
  27 | const SIN_SESION = 'requiere sesión: las políticas RLS de la biblioteca exigen rol authenticated';
  28 | 
  29 | test.describe('biblioteca de anuncios en el alta', () => {
  30 |   test('la zona de la biblioteca es visible aunque esté vacía', async ({ page }) => {
  31 |     await page.goto(`/${PROYECTO}/ideas/nueva`);
  32 | 
  33 |     // Sin sesión, RLS devuelve 0 anuncios: es el caso que escondía el botón.
  34 |     // Lo que se comprueba es que el motivo se lea, no que el catálogo tenga filas.
  35 |     const zona = page.getByRole('button', { name: BOTON_BIBLIOTECA }).first();
> 36 |     await expect(zona).toBeVisible();
     |                        ^ Error: expect(locator).toBeVisible() failed
  37 |     await expect(page.getByText(/no hay anuncios cargados/i)).toBeVisible();
  38 |   });
  39 | 
  40 |   test('con anuncios: se abre, busca, y rellena la referencia', async ({ page }) => {
  41 |     test.skip(!process.env.HUB_E2E_AUTH, SIN_SESION);
  42 | 
  43 |     await page.goto(`/${PROYECTO}/ideas/nueva`);
  44 |     await page.getByRole('button', { name: BOTON_BIBLIOTECA }).click();
  45 | 
  46 |     const buscador = page.getByRole('searchbox', { name: /biblioteca de anuncios/i });
  47 |     await expect(buscador).toBeVisible();
  48 |     expect(await page.locator('li button').count()).toBeGreaterThan(0);
  49 | 
  50 |     const campoReferencia = page.getByLabel(/REFERENCIA VISUAL/i);
  51 |     expect(await campoReferencia.inputValue()).toBe('');
  52 |     await page.locator('li button').first().click();
  53 |     await expect(campoReferencia).not.toHaveValue('');
  54 |     await expect(buscador).toBeHidden();
  55 |   });
  56 | 
  57 |   test('con anuncios: el buscador filtra, y no pisa un título escrito', async ({ page }) => {
  58 |     test.skip(!process.env.HUB_E2E_AUTH, SIN_SESION);
  59 | 
  60 |     await page.goto(`/${PROYECTO}/ideas/nueva`);
  61 |     await page.getByRole('button', { name: BOTON_BIBLIOTECA }).click();
  62 | 
  63 |     const buscador = page.getByRole('searchbox', { name: /biblioteca de anuncios/i });
  64 |     const todos = await page.locator('li button').count();
  65 |     expect(todos).toBeGreaterThan(0);
  66 | 
  67 |     await buscador.fill('zzzz-no-existe-zzz');
  68 |     await expect(page.getByText(/Nada con/i)).toBeVisible();
  69 |     expect(await page.locator('li button').count()).toBe(0);
  70 | 
  71 |     await buscador.fill('');
  72 |     expect(await page.locator('li button').count()).toBe(todos);
  73 | 
  74 |     // Y lo más importante: no pisa lo que la persona escribió.
  75 |     await page.getByLabel(/T[ÍI]TULO/i).first().fill('Un título que escribí yo');
  76 |     await page.locator('li button').first().click();
  77 |     await expect(page.getByLabel(/T[ÍI]TULO/i).first()).toHaveValue('Un título que escribí yo');
  78 |   });
  79 | });
  80 | 
```