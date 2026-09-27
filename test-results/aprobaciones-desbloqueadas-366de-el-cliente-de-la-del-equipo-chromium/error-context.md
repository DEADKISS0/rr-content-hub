# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: aprobaciones-desbloqueadas.spec.ts >> el tablero separa la espera del cliente de la del equipo
- Location: e2e/aprobaciones-desbloqueadas.spec.ts:16:5

# Error details

```
Error: el tablero debe decir quién espera al cliente

expect(locator).toBeVisible() failed

Locator: getByText(/ESPERANDO AL CLIENTE/)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - el tablero debe decir quién espera al cliente getByText(/ESPERANDO AL CLIENTE/) with timeout 10000ms
  - waiting for getByText(/ESPERANDO AL CLIENTE/)

```

```yaml
- complementary:
  - link "RR Aliados RR / WUNDEER":
    - /url: /wundeer
    - img "RR Aliados"
    - text: RR / WUNDEER
  - button "Compactar el menú" [expanded]
  - navigation "Menú principal":
    - link "EL TABLERO Todo el trabajo, de un vistazo":
      - /url: /wundeer
      - strong: EL TABLERO
      - text: Todo el trabajo, de un vistazo
    - link "LAS PIEZAS La lista completa":
      - /url: /wundeer/ideas
      - strong: LAS PIEZAS
      - text: La lista completa
    - link "ESPERA RESPUESTA Lo que hay que decidir":
      - /url: /wundeer/aprobaciones
      - strong: ESPERA RESPUESTA
      - text: Lo que hay que decidir
    - link "EL PLAN Cuánto falta para el final":
      - /url: /wundeer/roadmap
      - strong: EL PLAN
      - text: Cuánto falta para el final
    - group: VER MÁS
  - paragraph: RR CONTENT HUB · WUNDEER Datos vivos de Supabase
- banner:
  - link "WUNDEER · TODO EL CONTENIDO EN UN LUGAR":
    - /url: /wundeer
  - link "NUEVA PIEZA":
    - /url: /wundeer/ideas/nueva
- main:
  - paragraph: "[WUNDEER · OPERACIÓN VIVA]"
  - heading "El trabajo visible." [level=1]
  - paragraph: Contenido organico y pauta para Wundeer
  - text: "TU ROL: CLIENTE (LECTURA) 26 PIEZAS EN EL HUB 6 PIEZAS PARADAS"
  - link "VER TODO":
    - /url: /wundeer/ideas
  - region "Todo el flujo, en una vista.":
    - paragraph: "[MAPA DE OPERACIÓN]"
    - heading "Todo el flujo, en una vista." [level=2]
    - region "Hay 6 piezas esperando respuesta.":
      - paragraph: "[EMPIEZA POR AQUÍ]"
      - heading "Hay 6 piezas esperando respuesta." [level=2]
      - paragraph: "3 esperan al cliente y 3 al equipo de RR. Abre la de arriba: es la que más lleva parada."
      - list:
        - listitem:
          - link "P7 · ESPERA A CREATIVA · 16 DÍAS Arriesgarse es moda":
            - /url: /wundeer/ideas/422508ad-e753-4801-af60-20398d7be5a2
        - listitem:
          - link "O11 · ESPERA A CREATIVA · 16 DÍAS Brazos al cielo":
            - /url: /wundeer/ideas/028d3809-10ea-48f3-9c30-a2beaf9b296d
        - listitem:
          - link "P2 · ESPERA TU RESPUESTA · 16 DÍAS Tres objeciones, una prenda":
            - /url: /wundeer/ideas/e71e7d87-271d-4291-b60b-b59d30e7cfb6
        - listitem:
          - link "O9 · ESPERA TU RESPUESTA · 16 DÍAS Humor de pertenencia":
            - /url: /wundeer/ideas/fdbebfc2-3198-4c94-832e-a02d5c9a41fd
        - listitem:
          - 'link "O1 · ESPERA TU RESPUESTA · 16 DÍAS Macro: textura que se siente"':
            - /url: /wundeer/ideas/65bdc9af-bae1-4696-9679-c37afb858eb3
      - paragraph: Y 1 más abajo, en el trabajo completo.
    - navigation "Tipo de contenido":
      - button "TODO 26"
      - button "ORGANICO 16"
      - button "PAUTA 10"
    - region "Guía del flujo":
      - heading "Así avanza una pieza" [level=2]
      - text: TOCA UN PASO Y VES SOLO ESAS
      - button "¿QUÉ SIGNIFICA ESTO?"
      - list:
        - listitem:
          - 'button "PASO 01 IDEAS 11 PIEZAS La creativa propone y el cliente decide. ESPERA A: CREATIVA · CLIENTE"'
        - listitem:
          - 'button "PASO 02 GUIONES 10 PIEZAS Se escribe el guion y se aprueba. ESPERA A: CREATIVA"'
        - listitem:
          - 'button "PASO 03 PRODUCCIÓN 4 PIEZAS Se rueda, se sube el crudo, se monta y se aprueba el corte. ESPERA A: EDITOR · CÁMARA"'
        - listitem:
          - 'button "PASO 04 PUBLICADO 1 PIEZA Se publica, se registra la evidencia y se cierra. ESPERA A: —"'
    - textbox "Buscar piezas":
      - /placeholder: Buscar por código, título o categoría…
    - text: / 26 /26 PIEZAS · 3 ESPERANDO
    - group: VISTA Y RESPONSABLE
    - group: VER TODAS LAS 26 PIEZAS Y EL MAPA COMPLETO
  - paragraph: "[QUÉ ESTÁ DETENIDO]"
  - paragraph: "6"
  - heading "Piezas paradas." [level=2]
  - paragraph: "Ninguna avanza sin que alguien responda: 3 esperan al cliente y 3 al equipo de RR."
  - link "VER DECISIONES":
    - /url: /wundeer/aprobaciones
  - paragraph: "[QUIÉN ESTÁ ESPERANDO QUÉ]"
  - list:
    - listitem:
      - text: C
      - paragraph: CREATIVA · 3 PIEZAS
      - paragraph: P7 · O11 · O4
    - listitem:
      - text: C
      - paragraph: CLIENTE · 3 PIEZAS
      - paragraph: P2 · O9 · O1
- contentinfo:
  - img "RR Aliados"
  - paragraph: Deployed by RR Aliados
  - paragraph: Content Hub · WUNDEER
  - navigation "Enlaces del pie":
    - link "TABLERO":
      - /url: /wundeer
    - link "BANCO DE IDEAS":
      - /url: /wundeer/ideas
    - link "CAMBIAR DE PROYECTO":
      - /url: /select-project
- 'button "Abrir la guía: te explica cada botón"': ¿CÓMO SE USA?
- alert
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
> 22 |   await expect(externo, 'el tablero debe decir quién espera al cliente').toBeVisible();
     |                                                                          ^ Error: el tablero debe decir quién espera al cliente
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
  42 |   const destino = await page.locator('a.idea-card').first().getAttribute('href');
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