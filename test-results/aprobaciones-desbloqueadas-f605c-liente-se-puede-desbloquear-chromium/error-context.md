# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: aprobaciones-desbloqueadas.spec.ts >> una pieza que espera al cliente se puede desbloquear
- Location: e2e/aprobaciones-desbloqueadas.spec.ts:38:5

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.getAttribute: Test timeout of 45000ms exceeded.
Call log:
  - waiting for locator('a.idea-card').first()

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
  3  | const PROYECTO = 'wundeer';
  4  | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  5  | 
  6  | /**
  7  |  * Una pieza en `pending_approval` solo la mueve un `client_approver`. El roster
  8  |  * de Wundeer no tiene ninguno: hay 1 `client_viewer`, que es OTRO rol y no
  9  |  * puede aprobar. En apariencia son 3 piezas muertas.
  10 |  *
  11 |  * La salida es el arranque de emergencia del `owner` en `allowedTransitions()`:
  12 |  * quien sea owner puede aprobarlas. Este recorrido lo comprueba en la pantalla
  13 |  * de verdad, no leyendo el código — porque un arranque que existe en la tabla y
  14 |  * no llega a la interfaz deja las piezas igual de muertas.
  15 |  */
  16 | test('el tablero separa la espera del cliente de la del equipo', async ({ page }) => {
  17 |   await page.addInitScript(visto);
  18 |   await page.goto(`/${PROYECTO}`, { waitUntil: 'networkidle' });
  19 | 
  20 |   const externo = page.getByText(/ESPERANDO AL CLIENTE/);
  21 |   const interno = page.getByText(/PARA QUE AVANCE EL EQUIPO/);
  22 |   await expect(externo, 'el tablero debe decir quién espera al cliente').toBeVisible();
  23 |   await expect(interno, 'el tablero debe decir qué espera al equipo').toBeVisible();
  24 | 
  25 |   // Las dos cuentas son distintas y ninguna se presenta como "paradas": una
  26 |   // pieza esperando al cliente no está parada, está en manos de otro. Y la
  27 |   // palabra "PARADAS" era exactamente el dato que escondía las 22 piezas que el
  28 |   // equipo tiene que empujar.
  29 |   await expect(page.getByText(/PIEZAS PARADAS/)).toHaveCount(0);
  30 | 
  31 |   // Y la suma de las dos, más lo que ya no requiere acción, da el total.
  32 |   const total = Number((await page.getByText(/PIEZAS EN EL HUB/).innerText()).match(/(\d+)/)?.[1]);
  33 |   const nCliente = Number((await externo.innerText()).match(/(\d+)/)?.[1]);
  34 |   const nEquipo = Number((await interno.innerText()).match(/(\d+)/)?.[1]);
  35 |   expect(nCliente + nEquipo, 'cliente + equipo no puede pasar el total').toBeLessThanOrEqual(total);
  36 | });
  37 | 
  38 | test('una pieza que espera al cliente se puede desbloquear', async ({ page }) => {
  39 |   await page.addInitScript(visto);
  40 |   await page.goto(`/${PROYECTO}/aprobaciones`, { waitUntil: 'networkidle' });
  41 | 
> 42 |   const destino = await page.locator('a.idea-card').first().getAttribute('href');
     |                                                             ^ Error: locator.getAttribute: Test timeout of 45000ms exceeded.
  43 |   test.skip(!destino, 'la cola de aprobaciones no trae piezas');
  44 |   await page.goto(destino as string);
  45 | 
  46 |   const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  47 |   const hayMovimientos = await grupo.isVisible().catch(() => false);
  48 | 
  49 |   // La pieza no puede quedarse muda: o ofrece salida, o explica por qué.
  50 |   if (!hayMovimientos) {
  51 |     await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
  52 |     return;
  53 |   }
  54 | 
  55 |   const botones = await grupo.getByRole('button').allInnerTexts();
  56 |   // Si la pieza espera al cliente, el owner tiene que ver la salida: aprobar,
  57 |   // pedir ajustes o archivar. Sin esto, la pieza está atrapada en la práctica.
  58 |   const esperadas = ['APROBAR IDEA', 'SOLICITAR AJUSTES', 'ARCHIVAR PROPUESTA'];
  59 |   const ofrece = esperadas.some((etiqueta) => botones.join(' ').includes(etiqueta));
  60 |   expect(ofrece, `esperaba una salida de cliente, hubo: ${botones.join(' | ')}`).toBe(true);
  61 | });
  62 | 
```