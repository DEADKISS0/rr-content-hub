# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hub.spec.ts >> colas >> las pantallas sin base lo dicen en voz alta
- Location: e2e/hub.spec.ts:211:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/no se mide todavía/)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/no se mide todavía/) with timeout 10000ms
  - waiting for getByText(/no se mide todavía/)

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
  114 |   test('una sola acción para crear y ningún hueco vacío', async ({ page }) => {
  115 |     await abrir(page, `/${PROYECTO}`);
  116 | 
  117 |     // Una sola puerta para crear: la regla que quitó 13 botones y 2 CTA de más.
  118 |     // En modo abierto la puerta está puesta, así que se espera el botón —y solo
  119 |     // uno, en el header.
  120 |     await expect(page.locator('a.btn-brutal[href$="/ideas/nueva"]:visible')).toHaveCount(1);
  121 | 
  122 |     await expect(page.getByText('TOCA UN PASO Y VES SOLO ESAS')).toBeVisible();
  123 | 
  124 |     // El hueco punteado que se veía en 17 de 26 tarjetas ya no existe.
  125 |     await expect(page.getByText('SIN MINIATURA · ABRIR')).toHaveCount(0);
  126 | 
  127 |     for (const pista of PISTAS) {
  128 |       await expect(page.getByText(pista, { exact: true }).first()).toBeVisible();
  129 |     }
  130 |   });
  131 | });
  132 | 
  133 | test.describe('búsqueda', () => {
  134 |   test('el buscador está a la vista sin abrir nada', async ({ page }) => {
  135 |     await abrir(page, `/${PROYECTO}`);
  136 | 
  137 |     // El buscador estaba dentro de un <details> cerrado: quien buscaba "O1"
  138 |     // tenía que descubrir primero que existía un filtro. Ahora se ve siempre.
  139 |     await expect(page.getByLabel('Buscar piezas')).toBeVisible();
  140 |     expect(await desplegado(page, '[data-atajo-buscar]')).toBe(true);
  141 |   });
  142 | 
  143 |   test('el atajo "/" lleva al buscador y escribir filtra en vivo', async ({ page }) => {
  144 |     await abrir(page, `/${PROYECTO}`);
  145 | 
  146 |     await page.keyboard.press('/');
  147 |     await expect(page.getByLabel('Buscar piezas')).toBeFocused();
  148 | 
  149 |     // Código que SÍ existe. La prueba no es "quede 1": "O1" también casa con
  150 |     // O11, O12… porque la búsqueda es de texto libre, y eso es lo correcto. Lo
  151 |     // que se comprueba es que el contador BAJA de la lista completa.
  152 |     //
  153 |     // El total se lee del propio contador y no se escribe a mano: estaba
  154 |     // clavado en 25 y el tablero tiene 26 piezas, así que la prueba mentía
  155 |     // sobre datos viejos en vez de detectar el cambio. Un número pegado en un
  156 |     // test es una deuda: se rompe sola la primera vez que alguien crea algo.
  157 |     const contador = page.locator('text=/PIEZAS ·/').first();
  158 |     await expect(contador).toBeVisible();
  159 |     // El total se lee SIN filtro, para saber cuántas piezas tiene el proyecto.
  160 |     const total = (await contador.innerText()).match(/\/(\d+)/)?.[1];
  161 |     expect(total, 'el contador debe decir sobre cuántas piezas se filtra').toBeTruthy();
  162 | 
  163 |     await page.getByLabel('Buscar piezas').fill('macro');
  164 |     const filtradas = (await contador.innerText()).match(/^(\d+)\//)?.[1];
  165 | 
  166 |     // Filtrar tiene que reducir el universo, no dejar el mismo número.
  167 |     expect(Number(filtradas), 'la búsqueda no redujo nada').toBeLessThan(Number(total));
  168 |     await expect(contador).not.toContainText(`${total}/${total}`);
  169 | 
  170 |     await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  171 |     await expect(contador).toContainText(`${total}/${total}`);
  172 |   });
  173 | 
  174 |   test('buscar abre solo el tablero completo, sin dejar el contador solo', async ({ page }) => {
  175 |     await abrir(page, `/${PROYECTO}`);
  176 | 
  177 |     // Filtrar tiene que abrir el <details> del mapa: si no, el contador cambia
  178 |     // a "1/25 PIEZAS" sobre una pantalla cerrada y nadie entiende por qué.
  179 |     expect(await desplegado(page, '.idea-card')).toBe(false);
  180 | 
  181 |     await page.getByLabel('Buscar piezas').fill('O1');
  182 |     await expect(page.locator('.idea-card').first()).toBeVisible();
  183 |   });
  184 | });
  185 | 
  186 | test.describe('colas', () => {
  187 |   test('la cola abre por lo que más lleva parado', async ({ page }) => {
  188 |     await abrir(page, `/${PROYECTO}/aprobaciones`);
  189 |     await expect(page.getByText('PRIMERO LO QUE MÁS LLEVA PARADO')).toBeVisible();
  190 | 
  191 |     const tarjetas = page.locator('a.idea-card');
  192 |     const total = await tarjetas.count();
  193 |     expect(total).toBeGreaterThan(0);
  194 | 
  195 |     const dias: number[] = [];
  196 |     for (let i = 0; i < total; i += 1) {
  197 |       const valor = await tarjetas.nth(i).evaluate((tarjeta) => {
  198 |         for (const el of Array.from(tarjeta.querySelectorAll('span'))) {
  199 |           const texto = (el.textContent ?? '').trim();
  200 |           if (/^\d+D$/.test(texto)) return Number.parseInt(texto, 10);
  201 |         }
  202 |         return null;
  203 |       });
  204 |       if (valor !== null) dias.push(valor);
  205 |     }
  206 | 
  207 |     expect(dias.length).toBeGreaterThan(1);
  208 |     expect(dias).toEqual([...dias].sort((a, b) => b - a));
  209 |   });
  210 | 
  211 |   test('las pantallas sin base lo dicen en voz alta', async ({ page }) => {
  212 |     await abrir(page, `/${PROYECTO}/metricas`);
  213 |     // MÉTRICAS cuenta piezas y aclara que el rendimiento no se mide todavía.
> 214 |     await expect(page.getByText(/no se mide todavía/)).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  215 | 
  216 |     await page.goto(`/${PROYECTO}/publicaciones`);
  217 |     // La cola de salida existe; la fecha y el enlace de publicación, no.
  218 |     await expect(page.getByText('FALTA LA BASE PARA PROGRAMAR')).toBeVisible();
  219 |   });
  220 | });
  221 | 
  222 | test.describe('ficha de pieza', () => {
  223 |   test('la acción va arriba y el rol lo decide el servidor', async ({ page }) => {
  224 |     await abrir(page, `/${PROYECTO}/aprobaciones`);
  225 |     const destino = await page.locator('a.idea-card').first().getAttribute('href');
  226 |     expect(destino, 'la cola debería traer al menos una pieza').toBeTruthy();
  227 | 
  228 |     await page.goto(destino as string);
  229 | 
  230 |     // El panel de acción va en el primer pantallazo (antes vivía al final).
  231 |     await expect(page.getByText(/TU SIGUIENTE ACCIÓN/)).toBeInViewport();
  232 | 
  233 |     /**
  234 |      * Esta prueba cambió de significado con el modo abierto, y el cambio es el
  235 |      * bug que se tenía que ver.
  236 |      *
  237 |      * Antes afirmaba "sin sesión no hay transición": era verdad porque
  238 |      * `readOnly` traía `PUBLIC_MODE` de por medio. Al abrir el hub, el servidor
  239 |      * pasó a operar con rol `owner` (para que crear funcionara) pero la interfaz
  240 |      * siguió en lectura — la puerta y el rol contaban historias distintas y las
  241 |      * 25 piezas quedaron con "SIN ACCIÓN DISPONIBLE".
  242 |      *
  243 |      * Ahora lo que se protege es que la interfaz y el servidor coincidan: sin
  244 |      * sesión, en modo abierto, la pieza SÍ se puede mover. Lo que NO puede pasar
  245 |      * es que el rol llegue desde el navegador (`activeRole = 'owner'` cableado a
  246 |      * mano), así que el botón de cliente —único que `client_viewer` no puede
  247 |      * pulsar— jamás debe aparecer aquí.
  248 |      */
  249 |     const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  250 |     const tieneMovimientos = await grupo.isVisible().catch(() => false);
  251 |     if (tieneMovimientos) {
  252 |       /**
  253 |        * El `owner` SÍ puede aprobar: `allowedTransitions` le da paso a todo, y
  254 |        * esa es la razón de ser del arranque de emergencia. La aserción no
  255 |        * puede ser "el botón de cliente no aparece" —sería falsa—; lo que
  256 |        * protege es que la transición ofrecida sea REAL: que el estado de la
  257 |        * pieza ofrezca de verdad lo que se está a punto de prometer.
  258 |        */
  259 |       const botones = await grupo.getByRole('button').allInnerTexts();
  260 |       expect(botones.length, 'un grupo de movimientos vacío es un bug').toBeGreaterThan(0);
  261 |       for (const texto of botones) {
  262 |         expect(texto.trim().length, 'un botón de transición sin etiqueta').toBeGreaterThan(3);
  263 |       }
  264 |     } else {
  265 |       // Si no ofrece ninguno, lo dice y explica por qué. Nunca un vacío mudo.
  266 |       await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
  267 |     }
  268 |   });
  269 | });
  270 | 
  271 | test.describe('cambios de estado', () => {
  272 |   test('un movimiento pide confirmación y se puede cancelar sin tocar nada', async ({ page }) => {
  273 |     // No escribe en la base: se monta el panel de acción con el estado que
  274 |     // le corresponde y se comprueba que el segundo botón NO existe hasta que la
  275 |     // persona lo pide. Es la invariante que se rompió con un clic de dedazo.
  276 |     await abrir(page, `/${PROYECTO}/aprobaciones`);
  277 |     const destino = await page.locator('a.idea-card').first().getAttribute('href');
  278 |     expect(destino, 'la cola debería traer al menos una pieza').toBeTruthy();
  279 |     await page.goto(destino as string);
  280 | 
  281 |     // Sin sesión no hay movimientos que ofrecer, así que este recorrido
  282 |     // comprueba lo que sí se puede observar de forma honesta: el panel nunca
  283 |     // presenta un botón de un solo toque.
  284 |     const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  285 |     if (await grupo.count() > 0) {
  286 |       const primerBoton = grupo.getByRole('button').first();
  287 |       await primerBoton.click();
  288 |       // Armar no ejecuta: el botón de confirmar solo aparece después.
  289 |       await expect(grupo.getByRole('button', { name: 'SÍ, MOVER AHORA' })).toBeVisible();
  290 |       await grupo.getByRole('button', { name: 'CANCELAR' }).click();
  291 |       await expect(grupo.getByRole('button', { name: 'SÍ, MOVER AHORA' })).toHaveCount(0);
  292 |     } else {
  293 |       await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
  294 |     }
  295 |   });
  296 | });
  297 | 
  298 | test.describe('roadmap', () => {
  299 |   test('las tres pistas no muestran el mismo avance', async ({ page }) => {
  300 |     await abrir(page, `/${PROYECTO}/roadmap`);
  301 | 
  302 |     // Los medidores viven en la navegación de pistas (no en la tarjeta de
  303 |     // estado, que muestra días): comprobado contra el DOM real.
  304 |     const medidores = page.locator('nav[aria-label="Pistas del roadmap"] [role="img"]');
  305 |     await expect(medidores).toHaveCount(3);
  306 | 
  307 |     const avances: number[] = [];
  308 |     for (let i = 0; i < 3; i += 1) {
  309 |       const etiqueta = await medidores.nth(i).getAttribute('aria-label');
  310 |       const numero = Number.parseInt((etiqueta ?? '').replace(/\D+/g, ''), 10);
  311 |       expect(Number.isNaN(numero), `el medidor ${i} no trae porcentaje: ${etiqueta}`).toBe(false);
  312 |       avances.push(numero);
  313 |     }
  314 | 
```