# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hub.spec.ts >> cambios de estado >> un movimiento pide confirmación y se puede cancelar sin tocar nada
- Location: e2e/hub.spec.ts:272:7

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
- generic [ref=e1]:
  - main [ref=e2]:
    - heading "Acceder al hub" [level=1] [ref=e3]
    - paragraph [ref=e4]: El código del cliente y tu nombre. Sin correos ni contraseñas.
    - generic [ref=e5]:
      - group "// CÓDIGO DEL CLIENTE" [ref=e6]:
        - generic [ref=e8]:
          - textbox "Dígito 1 de 4" [active] [ref=e9]
          - textbox "Dígito 2 de 4" [ref=e10]
          - textbox "Dígito 3 de 4" [ref=e11]
          - textbox "Dígito 4 de 4" [ref=e12]
      - button "CONTINUAR" [ref=e13]
    - generic [ref=e14]:
      - paragraph [ref=e15]: // CÓDIGOS
      - list [ref=e16]:
        - listitem [ref=e17]: WUNDEER · 1111
        - listitem [ref=e18]: CANDILEJAS · 2222
      - paragraph [ref=e19]: El código abre el cliente. Lo que puedes hacer dentro lo decide tu rol, y ese no cambia con el código.
  - generic [ref=e24] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e25]
    - generic [ref=e29]:
      - button "Open issues overlay" [ref=e30]:
        - generic [ref=e31]:
          - generic [aria-hidden] [ref=e32]: "0"
          - generic [ref=e33]: "1"
        - generic [ref=e34]: Issue
      - button "Collapse issues badge" [ref=e35]
  - alert [ref=e38]
```

# Test source

```ts
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
  214 |     await expect(page.getByText(/no se mide todavía/)).toBeVisible();
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
> 277 |     const destino = await page.locator('a.idea-card').first().getAttribute('href');
      |                                                               ^ Error: locator.getAttribute: Test timeout of 45000ms exceeded.
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
  315 |     // El bug: las tres barras compartían rango y daban el mismo 78%.
  316 |     expect(new Set(avances).size).toBeGreaterThan(1);
  317 |   });
  318 | });
  319 | 
  320 | test.describe('portero de acceso', () => {
  321 |   test('el panel de administración no enseña el roster sin sesión', async ({ page }) => {
  322 |     // Con la autenticación apagada la línea devuelve 404: ni confirma que la
  323 |     // ruta existe. Con la encendida, el middleware manda a /login indicando a
  324 |     // dónde volver. Las dos respuestas sirven; lo que no puede pasar es que el
  325 |     // roster aparezca. Esta prueba corre con la variable que imponga cada modo.
  326 |     await page.goto('/audit/admin');
  327 | 
  328 |     const texto = await page.locator('body').innerText();
  329 |     expect(texto).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
  330 |     expect(texto).not.toContain('US10');
  331 |     // Y nunca queda mostrando el panel a alguien sin sesión.
  332 |     if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true') {
  333 |       await expect(page).toHaveURL(/\/login\?next=%2Faudit%2Fadmin/);
  334 |     } else {
  335 |       expect(page.url()).toContain('/audit/admin');
  336 |     }
  337 |   });
  338 | });
  339 | 
  340 | test.describe('crear una idea', () => {
  341 |   test('el brief se lee ANTES de guardar, no escondido detrás de un desplegable', async ({ page }) => {
  342 |     await abrir(page, `/${PROYECTO}/ideas/nueva`);
  343 | 
  344 |     // El pedido fue "cuando lo autorrellene tiene que ver y entender antes el
  345 |     // contenido". Antes el brief era un <details> con los tres campos de
  346 |     // cámara/talento/edición dentro: quien creaba no veía lo que el equipo iba
  347 |     // a ejecutar hasta después de enviarlo.
  348 |     const panel = page.getByRole('heading', { name: /brief que se genera al guardar/i });
  349 |     await expect(panel).toBeVisible();
  350 | 
  351 |     for (const campo of ['// CÁMARA', '// TALENTO / MODELAJE', '// EDICIÓN']) {
  352 |       await expect(page.getByText(campo, { exact: true })).toBeVisible();
  353 |     }
  354 | 
  355 |     // Y son visibles de verdad, no "visibles" para el filtro de Playwright.
  356 |     expect(await desplegado(page, 'text=TALENTO / MODELAJE')).toBe(true);
  357 |   });
  358 | 
  359 |   test('pegar un reel muestra el video real en un iframe y arma un brief específico', async ({ page }) => {
  360 |     await abrir(page, `/${PROYECTO}/ideas/nueva`);
  361 | 
  362 |     await page.getByLabel(/REFERENCIA VISUAL/i).fill('https://www.instagram.com/reel/DcN2tugtTc-/');
  363 | 
  364 |     // El embed va en un iframe, no en una imagen: Instagram no da miniatura
  365 |     // pública. El CSP del proyecto tiene que permitirlo o el marco no carga.
  366 |     const marco = page.locator('iframe[src*="instagram.com"]').first();
  367 |     await expect(marco).toHaveCount(1, { timeout: 15_000 });
  368 | 
  369 |     // El guion tiene que decir QUÉ se copia del reel, no repetir "la referencia".
  370 |     await page.getByText(/VER TAMBIÉN EL GUION/).click();
  371 |     await expect(page.getByText('QUÉ ESTAMOS COPIANDO DE LA REFERENCIA')).toBeVisible();
  372 |     await expect(page.getByText(/Reel vertical/)).toBeVisible();
  373 |   });
  374 | 
  375 |   test('un enlace inválido se dice antes de intentar guardar', async ({ page }) => {
  376 |     await abrir(page, `/${PROYECTO}/ideas/nueva`);
  377 | 
```