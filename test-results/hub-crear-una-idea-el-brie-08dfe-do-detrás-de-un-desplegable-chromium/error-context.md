# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hub.spec.ts >> crear una idea >> el brief se lee ANTES de guardar, no escondido detrás de un desplegable
- Location: e2e/hub.spec.ts:341:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /brief que se genera al guardar/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /brief que se genera al guardar/i }) with timeout 10000ms
  - waiting for getByRole('heading', { name: /brief que se genera al guardar/i })

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
> 349 |     await expect(panel).toBeVisible();
      |                         ^ Error: expect(locator).toBeVisible() failed
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
  378 |     await page.getByLabel(/REFERENCIA VISUAL/i).fill('esto no es un enlace');
  379 |     await expect(page.getByRole('alert').first()).toContainText('no parece un enlace válido');
  380 | 
  381 |     // El botón de crear queda deshabilitado: no se puede mandar una idea sin
  382 |     // referencia, que es lo que la validación del servidor exige.
  383 |     await expect(page.getByRole('button', { name: /CREAR IDEA/ })).toBeDisabled();
  384 |   });
  385 | });
  386 | 
  387 | test.describe('modo guía', () => {
  388 |   test('se abre sola la primera vez y explica el primer botón', async ({ page }) => {
  389 |     await page.goto(`/${PROYECTO}`);
  390 | 
  391 |     // Sin nada guardado, la guía arranca sola: es la respuesta a "que siempre
  392 |     // que uno abra le explique botón por botón".
  393 |     await expect(page.getByText(/PASO 1 DE 6/)).toBeVisible({ timeout: 15_000 });
  394 |     await expect(page.getByRole('heading', { name: 'Este es el menú' })).toBeVisible();
  395 |   });
  396 | 
  397 |   test('saltarla la marca vista: no vuelve a saltar sola en la pantalla siguiente', async ({ page }) => {
  398 |     await page.goto(`/${PROYECTO}`);
  399 |     await expect(page.getByText(/PASO 1 DE 6/)).toBeVisible({ timeout: 15_000 });
  400 |     await page.getByRole('button', { name: 'SALTAR' }).click();
  401 |     await expect(page.getByText(/PASO 1 DE 6/)).toHaveCount(0);
  402 | 
  403 |     await page.goto(`/${PROYECTO}/aprobaciones`);
  404 |     await expect(page.getByText(/PASO 1 DE/)).toHaveCount(0);
  405 |     await expect(page.getByRole('button', { name: /Abrir la guía/ })).toBeVisible();
  406 |   });
  407 | 
  408 |   test('avanza botón por botón y se cierra con Escape', async ({ page }) => {
  409 |     await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
  410 |     await page.goto(`/${PROYECTO}`);
  411 | 
  412 |     await page.getByRole('button', { name: /Abrir la guía/ }).click();
  413 |     await expect(page.getByText(/PASO 1 DE 6/)).toBeVisible();
  414 | 
  415 |     await page.getByRole('button', { name: /SIGUIENTE/ }).click();
  416 |     await expect(page.getByRole('heading', { name: 'Aquí se crea una pieza' })).toBeVisible();
  417 |     await expect(page.getByText(/PASO 2 DE 6/)).toBeVisible();
  418 | 
  419 |     await page.keyboard.press('Escape');
  420 |     await expect(page.getByRole('heading', { name: 'Aquí se crea una pieza' })).toHaveCount(0);
  421 |   });
  422 | 
  423 |   test('en la ficha explica la acción, el preview y el brief', async ({ page }) => {
  424 |     await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
  425 |     await page.goto(`/${PROYECTO}/aprobaciones`);
  426 |     const destino = await page.locator('a.idea-card').first().getAttribute('href');
  427 | 
  428 |     await page.goto(destino as string);
  429 |     await page.getByRole('button', { name: /Abrir la guía/ }).click();
  430 | 
  431 |     await expect(page.getByRole('heading', { name: 'Esta es tu pieza' })).toBeVisible();
  432 |     await page.getByRole('button', { name: /SIGUIENTE/ }).click();
  433 |     await expect(page.getByRole('heading', { name: 'Lo primero: qué hacer ahora' })).toBeVisible();
  434 |   });
  435 | 
  436 |   test('la referencia aparece UNA sola vez, en el iframe de abajo', async ({ page }) => {
  437 |     await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
  438 |     await page.goto(`/${PROYECTO}/aprobaciones`);
  439 |     const destino = await page.locator('a.idea-card').first().getAttribute('href');
  440 |     await page.goto(destino as string);
  441 | 
  442 |     // El preview de arriba mostraba la referencia por segunda vez, con otro
  443 |     // componente y otra etiqueta. La ficha debe traer UN solo iframe.
  444 |     await expect(page.locator('iframe')).toHaveCount(1);
  445 |     // Y el rótulo del preview duplicado no puede seguir en la página.
  446 |     await expect(page.getByText('CÓMO SE VERÁ PUBLICADO')).toHaveCount(0);
  447 |   });
  448 | });
  449 | 
```