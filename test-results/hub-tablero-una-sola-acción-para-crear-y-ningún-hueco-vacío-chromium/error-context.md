# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hub.spec.ts >> tablero >> una sola acción para crear y ningún hueco vacío
- Location: e2e/hub.spec.ts:114:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('a.btn-brutal[href$="/ideas/nueva"]:visible')
Expected: 1
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" locator('a.btn-brutal[href$="/ideas/nueva"]:visible') with timeout 10000ms
  - waiting for locator('a.btn-brutal[href$="/ideas/nueva"]:visible')
    23 × locator resolved to 0 elements
       - unexpected value "0"

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
  20  | const PROYECTO = 'wundeer';
  21  | 
  22  | /**
  23  |  * Borra la pieza que creó la prueba de creación.
  24  |  *
  25  |  * La limpieza va por la Management API de Supabase con el token del MCP, que es
  26  |  * lo único con permisos de escritura sobre la base real. Se borran también los
  27  |  * eventos, o quedarían filas apuntando a una idea que no existe.
  28  |  *
  29  |  * Solo corre contra producción (`HUB_BASE_URL`): con el dev server el alta nunca
  30  |  * llega a completarse, así que no hay nada que borrar y no hay nada que
  31  |  * limpiar. Y si el borrado falla, el test falla — una base con filas de prueba
  32  |  * es peor que una suite roja.
  33  |  */
  34  | /**
  35  |  * Borra por la marca de la corrida, sin saber el id.
  36  |  *
  37  |  * Es el plan B para cuando el alta funcionó pero el navegador no navegó a la
  38  |  * ficha. Antes, ese camino devolvía la prueba como "pasada" y dejaba la fila.
  39  |  */
  40  | async function borrarPorMarca(marca: string): Promise<boolean> {
  41  |   if (!process.env.HUB_BASE_URL) return true;
  42  |   return borrarIdeaDePrueba('', marca);
  43  | }
  44  | 
  45  | async function borrarIdeaDePrueba(ideaId: string, marca: string): Promise<boolean> {
  46  |   if (!process.env.HUB_BASE_URL) return true; // el alta falló en local: no hay fila
  47  | 
  48  |   const tituloLimpio = marca.replace(/[^0-9A-Za-z ]/g, '');
  49  |   const conId = /^[0-9a-f-]{36}$/.test(ideaId);
  50  | 
  51  |   const { readFileSync, writeFileSync, mkdtempSync } = await import('node:fs');
  52  |   const { homedir } = await import('node:os');
  53  |   const { join } = await import('node:path');
  54  |   const { execFile } = await import('node:child_process');
  55  |   const { promisify } = await import('node:util');
  56  |   const run = promisify(execFile);
  57  | 
  58  |   const tokenPath = join(homedir(), '.hermes', 'mcp-tokens', 'supabase.json');
  59  |   const token = JSON.parse(readFileSync(tokenPath, 'utf8')).access_token as string;
  60  |   const temporal = mkdtempSync(join(homedir(), '.hermes', 'cache', 'scratch', 'borrar-'));
  61  | 
  62  |   // El SQL va en un archivo y se ejecuta con `scripts/borrar-idea-prueba.py`, no
  63  |   // por línea de comandos: lo que corre se puede leer antes, y el token no
  64  |   // queda en el historial del shell.
  65  |   const sqlFile = join(temporal, 'borrar.sql');
  66  |   // Sin id se borra por marca; con id, se ancla al id y la marca hace de red.
  67  |   const donde = conId ? `id = '${ideaId}'` : `title like '%${tituloLimpio}%'`;
  68  |   writeFileSync(sqlFile, [
  69  |     `delete from rr_hub_events where idea_id in (select id from rr_hub_ideas where ${donde});`,
  70  |     `delete from rr_hub_comments where idea_id in (select id from rr_hub_ideas where ${donde});`,
  71  |     `delete from rr_hub_ideas where ${donde};`,
  72  |   ].join('\n'));
  73  | 
  74  |   try {
  75  |     const salida = await run('python3', [join(process.cwd(), 'scripts', 'borrar-idea-prueba.py'), sqlFile, token], { timeout: 30_000 });
  76  |     console.log(`[limpieza] ${conId ? `id ${ideaId}` : `marca «${marca}»`} -> ${salida.stdout.trim()}`);
  77  |     return true;
  78  |   } catch (e) {
  79  |     const err = e as { stderr?: Buffer | string; stdout?: Buffer | string };
  80  |     console.error(`[limpieza] fallo: ${String(err.stderr ?? '').trim() || String(err.stdout ?? '').trim()}`);
  81  |     return false;
  82  |   }
  83  | }
  84  | 
  85  | /** Las cuatro pistas del tablero, tal como las ve el usuario. */
  86  | const PISTAS = ['IDEAS', 'GUIONES', 'PRODUCCIÓN', 'PUBLICADO'];
  87  | 
  88  | /**
  89  |  * Los recorridos que NO son de la guía la desactivan. La guía se abre sola en
  90  |  * la primera visita (es su razón de ser) y eso mueve el foco y tapa cosas:
  91  |  * estas pruebas miden otras invariantes. La guía tiene sus propias pruebas.
  92  |  */
  93  | async function abrir(page: import('@playwright/test').Page, ruta: string) {
  94  |   await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
  95  |   await page.goto(ruta);
  96  | }
  97  | 
  98  | /**
  99  |  * ¿Está realmente desplegado este control? `isVisible()` no basta: un `<details>`
  100 |  * cerrado sigue teniendo su `<summary>` en pantalla, y por dentro sus hijos
  101 |  * cuentan como visibles para el filtro de Playwright. Esto pregunta al DOM qué
  102 |  * se está pintando de verdad.
  103 |  */
  104 | async function desplegado(page: import('@playwright/test').Page, selector: string): Promise<boolean> {
  105 |   return page.locator(selector).first().evaluate((el) => {
  106 |     const nodo = el as HTMLElement;
  107 |     return typeof nodo.checkVisibility === 'function'
  108 |       ? nodo.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
  109 |       : nodo.offsetParent !== null;
  110 |   });
  111 | }
  112 | 
  113 | test.describe('tablero', () => {
  114 |   test('una sola acción para crear y ningún hueco vacío', async ({ page }) => {
  115 |     await abrir(page, `/${PROYECTO}`);
  116 | 
  117 |     // Una sola puerta para crear: la regla que quitó 13 botones y 2 CTA de más.
  118 |     // En modo abierto la puerta está puesta, así que se espera el botón —y solo
  119 |     // uno, en el header.
> 120 |     await expect(page.locator('a.btn-brutal[href$="/ideas/nueva"]:visible')).toHaveCount(1);
      |                                                                              ^ Error: expect(locator).toHaveCount(expected) failed
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
  214 |     await expect(page.getByText(/no se mide todavía/)).toBeVisible();
  215 | 
  216 |     await page.goto(`/${PROYECTO}/publicaciones`);
  217 |     // La cola de salida existe; la fecha y el enlace de publicación, no.
  218 |     await expect(page.getByText('FALTA LA BASE PARA PROGRAMAR')).toBeVisible();
  219 |   });
  220 | });
```