# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: assign-owner.spec.ts >> asignar responsable >> el bloque nombra a alguien real del roster y explica el hueco
- Location: e2e/assign-owner.spec.ts:8:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('// RESPONSABLE DE LA PIEZA').or(getByText('// RESPONSABLE'))
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('// RESPONSABLE DE LA PIEZA').or(getByText('// RESPONSABLE')) with timeout 10000ms
  - waiting for getByText('// RESPONSABLE DE LA PIEZA').or(getByText('// RESPONSABLE'))

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
  4  | const PROYECTO = 'wundeer';
  5  | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  6  | 
  7  | test.describe('asignar responsable', () => {
  8  |   test('el bloque nombra a alguien real del roster y explica el hueco', async ({ page }) => {
  9  |     await page.addInitScript(visto);
  10 |     await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  11 | 
  12 |     const bloque = page.getByRole('complementary').or(page.locator('aside'));
  13 |     // El bloque tiene que existir siempre, tenga o no responsable.
> 14 |     await expect(page.getByText('// RESPONSABLE DE LA PIEZA').or(page.getByText('// RESPONSABLE'))).toBeVisible();
     |                                                                                                     ^ Error: expect(locator).toBeVisible() failed
  15 | 
  16 |     // Sin responsable, el select ofrece el roster real, con nombre y rol.
  17 |     const select = page.getByLabel('// QUIÉN RESPONDE');
  18 |     if (await select.count()) {
  19 |       const opciones = await select.locator('option').allInnerTexts();
  20 |       expect(opciones.length, 'el roster de Wundeer tiene 16 personas').toBeGreaterThan(5);
  21 |       // Ninguna opción puede decir "sin sesión": es una persona, no un rol roto.
  22 |       expect(opciones.join(' ')).not.toContain('sin sesión');
  23 |       // Y el botón no se habilita hasta elegir: no se deshabilita por algo invisible.
  24 |       await expect(page.getByRole('button', { name: /ASIGNAR RESPONSABLE/ })).toBeDisabled();
  25 |     }
  26 |   });
  27 | 
  28 |   test('no promete una transición de rol: asignar no cambia la fase', async ({ page }) => {
  29 |     await page.addInitScript(visto);
  30 |     await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  31 | 
  32 |     // Asignar un responsable es metadata, no un cambio de estado. Si alguien lo
  33 |     // metió en `allowedTransitions()`, aparecería un estado nuevo en el flujo de
  34 |     // 13 y esta aserción lo delataría.
  35 |     const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  36 |     if (await grupo.isVisible().catch(() => false)) {
  37 |       const botones = await grupo.getByRole('button').allInnerTexts();
  38 |       expect(botones.join(' ')).not.toMatch(/ASIGNAR RESPONSABLE/i);
  39 |     }
  40 |   });
  41 | });
  42 | 
```