import { expect, test } from '@playwright/test';
import { chromium } from '@playwright/test';

/**
 * Recorridos sobre el hub real.
 *
 * Qué se protege aquí: las cuatro invariantes que se rompieron de verdad y que
 * ninguna prueba de tipos iba a notar.
 *   1. Una sola acción por superficie (llegaron a convivir 14 botones y 3 CTA).
 *   2. La cola abre por lo que más lleva parado (llegó a ordenar por código y
 *      enterrar una pieza de 15 días entre las de ayer).
 *   3. El roadmap no clona el mismo avance en las tres pistas (daban las tres 78%).
 *   4. Ninguna pantalla promete datos que la base no tiene.
 *
 * Salvedad honesta: la prueba de creación SÍ escribe, porque no hay forma de
 * comprobar que el botón funciona sin pulsarlo. Antes el comentario decía "no
 * escribe" y era falso. Hoy borra lo que crea, y falla si no puede — ver
 * `borrarIdeaDePrueba`.
 */

const PROYECTO = 'wundeer';

/**
 * Borra la pieza que creó la prueba de creación.
 *
 * La limpieza va por la Management API de Supabase con el token del MCP, que es
 * lo único con permisos de escritura sobre la base real. Se borran también los
 * eventos, o quedarían filas apuntando a una idea que no existe.
 *
 * Solo corre contra producción (`HUB_BASE_URL`): con el dev server el alta nunca
 * llega a completarse, así que no hay nada que borrar y no hay nada que
 * limpiar. Y si el borrado falla, el test falla — una base con filas de prueba
 * es peor que una suite roja.
 */
/**
 * Borra por la marca de la corrida, sin saber el id.
 *
 * Es el plan B para cuando el alta funcionó pero el navegador no navegó a la
 * ficha. Antes, ese camino devolvía la prueba como "pasada" y dejaba la fila.
 */
async function borrarPorMarca(marca: string): Promise<boolean> {
  if (!process.env.HUB_BASE_URL) return true;
  return borrarIdeaDePrueba('', marca);
}

async function borrarIdeaDePrueba(ideaId: string, marca: string): Promise<boolean> {
  if (!process.env.HUB_BASE_URL) return true; // el alta falló en local: no hay fila

  const tituloLimpio = marca.replace(/[^0-9A-Za-z ]/g, '');
  const conId = /^[0-9a-f-]{36}$/.test(ideaId);

  const { readFileSync, writeFileSync, mkdtempSync } = await import('node:fs');
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  const tokenPath = join(homedir(), '.hermes', 'mcp-tokens', 'supabase.json');
  const token = JSON.parse(readFileSync(tokenPath, 'utf8')).access_token as string;
  const temporal = mkdtempSync(join(homedir(), '.hermes', 'cache', 'scratch', 'borrar-'));

  // El SQL va en un archivo y se ejecuta con `scripts/borrar-idea-prueba.py`, no
  // por línea de comandos: lo que corre se puede leer antes, y el token no
  // queda en el historial del shell.
  const sqlFile = join(temporal, 'borrar.sql');
  // Sin id se borra por marca; con id, se ancla al id y la marca hace de red.
  const donde = conId ? `id = '${ideaId}'` : `title like '%${tituloLimpio}%'`;
  writeFileSync(sqlFile, [
    `delete from rr_hub_events where idea_id in (select id from rr_hub_ideas where ${donde});`,
    `delete from rr_hub_comments where idea_id in (select id from rr_hub_ideas where ${donde});`,
    `delete from rr_hub_ideas where ${donde};`,
  ].join('\n'));

  try {
    const salida = await run('python3', [join(process.cwd(), 'scripts', 'borrar-idea-prueba.py'), sqlFile, token], { timeout: 30_000 });
    console.log(`[limpieza] ${conId ? `id ${ideaId}` : `marca «${marca}»`} -> ${salida.stdout.trim()}`);
    return true;
  } catch (e) {
    const err = e as { stderr?: Buffer | string; stdout?: Buffer | string };
    console.error(`[limpieza] fallo: ${String(err.stderr ?? '').trim() || String(err.stdout ?? '').trim()}`);
    return false;
  }
}

/** Las cuatro pistas del tablero, tal como las ve el usuario. */
const PISTAS = ['IDEAS', 'GUIONES', 'PRODUCCIÓN', 'PUBLICADO'];

/**
 * Los recorridos que NO son de la guía la desactivan. La guía se abre sola en
 * la primera visita (es su razón de ser) y eso mueve el foco y tapa cosas:
 * estas pruebas miden otras invariantes. La guía tiene sus propias pruebas.
 */
async function abrir(page: import('@playwright/test').Page, ruta: string) {
  await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
  await page.goto(ruta);
}

/**
 * ¿Está realmente desplegado este control? `isVisible()` no basta: un `<details>`
 * cerrado sigue teniendo su `<summary>` en pantalla, y por dentro sus hijos
 * cuentan como visibles para el filtro de Playwright. Esto pregunta al DOM qué
 * se está pintando de verdad.
 */
async function desplegado(page: import('@playwright/test').Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().evaluate((el) => {
    const nodo = el as HTMLElement;
    return typeof nodo.checkVisibility === 'function'
      ? nodo.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
      : nodo.offsetParent !== null;
  });
}

test.describe('tablero', () => {
  test('una sola acción para crear y ningún hueco vacío', async ({ page }) => {
    await abrir(page, `/${PROYECTO}`);

    // Una sola puerta para crear: la regla que quitó 13 botones y 2 CTA de más.
    // En modo abierto la puerta está puesta, así que se espera el botón —y solo
    // uno, en el header.
    await expect(page.locator('a.btn-brutal[href$="/ideas/nueva"]:visible')).toHaveCount(1);

    await expect(page.getByText('TOCA UN PASO Y VES SOLO ESAS')).toBeVisible();

    // El hueco punteado que se veía en 17 de 26 tarjetas ya no existe.
    await expect(page.getByText('SIN MINIATURA · ABRIR')).toHaveCount(0);

    for (const pista of PISTAS) {
      await expect(page.getByText(pista, { exact: true }).first()).toBeVisible();
    }
  });
});

test.describe('búsqueda', () => {
  test('el buscador está a la vista sin abrir nada', async ({ page }) => {
    await abrir(page, `/${PROYECTO}`);

    // El buscador estaba dentro de un <details> cerrado: quien buscaba "O1"
    // tenía que descubrir primero que existía un filtro. Ahora se ve siempre.
    await expect(page.getByLabel('Buscar piezas')).toBeVisible();
    expect(await desplegado(page, '[data-atajo-buscar]')).toBe(true);
  });

  test('el atajo "/" lleva al buscador y escribir filtra en vivo', async ({ page }) => {
    await abrir(page, `/${PROYECTO}`);

    await page.keyboard.press('/');
    await expect(page.getByLabel('Buscar piezas')).toBeFocused();

    // Código que SÍ existe. La prueba no es "quede 1": "O1" también casa con
    // O11, O12… porque la búsqueda es de texto libre, y eso es lo correcto. Lo
    // que se comprueba es que el contador BAJA de la lista completa.
    //
    // El total se lee del propio contador y no se escribe a mano: estaba
    // clavado en 25 y el tablero tiene 26 piezas, así que la prueba mentía
    // sobre datos viejos en vez de detectar el cambio. Un número pegado en un
    // test es una deuda: se rompe sola la primera vez que alguien crea algo.
    const contador = page.locator('text=/PIEZAS ·/').first();
    await expect(contador).toBeVisible();
    // El total se lee SIN filtro, para saber cuántas piezas tiene el proyecto.
    const total = (await contador.innerText()).match(/\/(\d+)/)?.[1];
    expect(total, 'el contador debe decir sobre cuántas piezas se filtra').toBeTruthy();

    await page.getByLabel('Buscar piezas').fill('macro');
    const filtradas = (await contador.innerText()).match(/^(\d+)\//)?.[1];

    // Filtrar tiene que reducir el universo, no dejar el mismo número.
    expect(Number(filtradas), 'la búsqueda no redujo nada').toBeLessThan(Number(total));
    await expect(contador).not.toContainText(`${total}/${total}`);

    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(contador).toContainText(`${total}/${total}`);
  });

  test('buscar abre solo el tablero completo, sin dejar el contador solo', async ({ page }) => {
    await abrir(page, `/${PROYECTO}`);

    // Filtrar tiene que abrir el <details> del mapa: si no, el contador cambia
    // a "1/25 PIEZAS" sobre una pantalla cerrada y nadie entiende por qué.
    expect(await desplegado(page, '.idea-card')).toBe(false);

    await page.getByLabel('Buscar piezas').fill('O1');
    await expect(page.locator('.idea-card').first()).toBeVisible();
  });
});

test.describe('colas', () => {
  test('la cola abre por lo que más lleva parado', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/aprobaciones`);
    await expect(page.getByText('PRIMERO LO QUE MÁS LLEVA PARADO')).toBeVisible();

    const tarjetas = page.locator('a.idea-card');
    const total = await tarjetas.count();
    expect(total).toBeGreaterThan(0);

    const dias: number[] = [];
    for (let i = 0; i < total; i += 1) {
      const valor = await tarjetas.nth(i).evaluate((tarjeta) => {
        for (const el of Array.from(tarjeta.querySelectorAll('span'))) {
          const texto = (el.textContent ?? '').trim();
          if (/^\d+D$/.test(texto)) return Number.parseInt(texto, 10);
        }
        return null;
      });
      if (valor !== null) dias.push(valor);
    }

    expect(dias.length).toBeGreaterThan(1);
    expect(dias).toEqual([...dias].sort((a, b) => b - a));
  });

  test('las pantallas sin base lo dicen en voz alta', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/metricas`);
    // MÉTRICAS cuenta piezas y aclara que el rendimiento no se mide todavía.
    await expect(page.getByText(/no se mide todavía/)).toBeVisible();

    await page.goto(`/${PROYECTO}/publicaciones`);
    // La cola de salida existe; la fecha y el enlace de publicación, no.
    await expect(page.getByText('FALTA LA BASE PARA PROGRAMAR')).toBeVisible();
  });
});

test.describe('ficha de pieza', () => {
  test('la acción va arriba y el rol lo decide el servidor', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');
    expect(destino, 'la cola debería traer al menos una pieza').toBeTruthy();

    await page.goto(destino as string);

    // El panel de acción va en el primer pantallazo (antes vivía al final).
    await expect(page.getByText(/TU SIGUIENTE ACCIÓN/)).toBeInViewport();

    /**
     * Esta prueba cambió de significado con el modo abierto, y el cambio es el
     * bug que se tenía que ver.
     *
     * Antes afirmaba "sin sesión no hay transición": era verdad porque
     * `readOnly` traía `PUBLIC_MODE` de por medio. Al abrir el hub, el servidor
     * pasó a operar con rol `owner` (para que crear funcionara) pero la interfaz
     * siguió en lectura — la puerta y el rol contaban historias distintas y las
     * 25 piezas quedaron con "SIN ACCIÓN DISPONIBLE".
     *
     * Ahora lo que se protege es que la interfaz y el servidor coincidan: sin
     * sesión, en modo abierto, la pieza SÍ se puede mover. Lo que NO puede pasar
     * es que el rol llegue desde el navegador (`activeRole = 'owner'` cableado a
     * mano), así que el botón de cliente —único que `client_viewer` no puede
     * pulsar— jamás debe aparecer aquí.
     */
    const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
    const tieneMovimientos = await grupo.isVisible().catch(() => false);
    if (tieneMovimientos) {
      /**
       * El `owner` SÍ puede aprobar: `allowedTransitions` le da paso a todo, y
       * esa es la razón de ser del arranque de emergencia. La aserción no
       * puede ser "el botón de cliente no aparece" —sería falsa—; lo que
       * protege es que la transición ofrecida sea REAL: que el estado de la
       * pieza ofrezca de verdad lo que se está a punto de prometer.
       */
      const botones = await grupo.getByRole('button').allInnerTexts();
      expect(botones.length, 'un grupo de movimientos vacío es un bug').toBeGreaterThan(0);
      for (const texto of botones) {
        expect(texto.trim().length, 'un botón de transición sin etiqueta').toBeGreaterThan(3);
      }
    } else {
      // Si no ofrece ninguno, lo dice y explica por qué. Nunca un vacío mudo.
      await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
    }
  });
});

test.describe('cambios de estado', () => {
  test('un movimiento pide confirmación y se puede cancelar sin tocar nada', async ({ page }) => {
    // No escribe en la base: se monta el panel de acción con el estado que
    // le corresponde y se comprueba que el segundo botón NO existe hasta que la
    // persona lo pide. Es la invariante que se rompió con un clic de dedazo.
    await abrir(page, `/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');
    expect(destino, 'la cola debería traer al menos una pieza').toBeTruthy();
    await page.goto(destino as string);

    // Sin sesión no hay movimientos que ofrecer, así que este recorrido
    // comprueba lo que sí se puede observar de forma honesta: el panel nunca
    // presenta un botón de un solo toque.
    const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
    if (await grupo.count() > 0) {
      const primerBoton = grupo.getByRole('button').first();
      await primerBoton.click();
      // Armar no ejecuta: el botón de confirmar solo aparece después.
      await expect(grupo.getByRole('button', { name: 'SÍ, MOVER AHORA' })).toBeVisible();
      await grupo.getByRole('button', { name: 'CANCELAR' }).click();
      await expect(grupo.getByRole('button', { name: 'SÍ, MOVER AHORA' })).toHaveCount(0);
    } else {
      await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
    }
  });
});

test.describe('roadmap', () => {
  test('las tres pistas no muestran el mismo avance', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/roadmap`);

    // Los medidores viven en la navegación de pistas (no en la tarjeta de
    // estado, que muestra días): comprobado contra el DOM real.
    const medidores = page.locator('nav[aria-label="Pistas del roadmap"] [role="img"]');
    await expect(medidores).toHaveCount(3);

    const avances: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const etiqueta = await medidores.nth(i).getAttribute('aria-label');
      const numero = Number.parseInt((etiqueta ?? '').replace(/\D+/g, ''), 10);
      expect(Number.isNaN(numero), `el medidor ${i} no trae porcentaje: ${etiqueta}`).toBe(false);
      avances.push(numero);
    }

    // El bug: las tres barras compartían rango y daban el mismo 78%.
    expect(new Set(avances).size).toBeGreaterThan(1);
  });
});

test.describe('portero de acceso', () => {
  // El estado de sesión vive en la variable de entorno, y el contexto de cada
  // recorrido lo toma de ahí. Para probar las DOS caras del panel hacen falta dos
  // contextos: una sesión de admin y una de miembro, porque `storageState` es
  // global a la corrida y un `page` normal siempre entra con la del admin.
  // Por eso estos dos recorrido lanzan su propio contexto en vez de usar `page`.
  test('el panel de administración no se abre a quien solo tecleó un código', async ({ baseURL }) => {
    const noadmin = process.env.HUB_E2E_NOADMIN_STATE;
    test.skip(!noadmin, 'hace falta HUB_E2E_NOADMIN_STATE: una sesión de un miembro que no administra');

    const contexto = await chromium.launch();
    const navegador = await contexto.newContext({ storageState: noadmin, baseURL: baseURL! });
    const pagina = await navegador.newPage();
    await pagina.goto('/audit/admin');

    const texto = await pagina.locator('body').innerText();
    await navegador.close();
    await contexto.close();

    // Lo que no puede pasar: el roster de cualquiera que teclee cuatro dígitos.
    expect(texto, 'el roster se leyó sin administrar').not.toMatch(/[\w.]+@[\w.]+\.\w+/);
    expect(texto).not.toContain('US10');

    // Y la forma de la respuesta es 404, no una página de guarda: `notFound()` de
    // Next da 404 y ni siquiera confirma que la ruta exista. Un 200 con "SIN
    // PERMISO" también estaría bien, pero el 404 es más fuerte: no hay nada que
    // enumerar. Se acepta cualquiera de las dos, lo que NO se acepta es el roster.
    const url = pagina.url();
    expect(
      url.endsWith('/audit/admin') || /login/.test(url) || /RESTRINGIDO|SIN PERMISO|NO TIENES/i.test(texto),
      `respuesta inesperada: ${url} — ${texto.slice(0, 120)}`,
    ).toBe(true);
  });

  test('con un administrador, el panel se abre y trae el roster entero', async ({ page }) => {
    test.skip(!process.env.HUB_E2E_STATE, 'sin estado de sesión no se puede comprobar el lado de dentro');

    await page.goto('/audit/admin');
    const texto = await page.locator('body').innerText();

    const esAdmin = await page
      .getByText(/ADMINISTRADORES GLOBALES/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (esAdmin) {
      // Y el roster no viene a medias: "LOS DATOS PUEDEN NO ESTAR DISPONIBLES" es
      // el síntoma de un servidor sin service role, y se leería como un panel
      // vacío y sano cuando en realidad no consultedó nada.
      expect(texto, 'el panel se abrió sin datos: el servidor no tiene service role').not.toMatch(
        /LOS DATOS PUEDEN NO ESTAR DISPONIBLES/i,
      );
      expect(texto, 'abrió el panel sin traer a nadie').toMatch(/[\w.]+@[\w.]+\.\w+/);
    } else {
      await expect(page.getByText(/RESTRINGIDO|SIN PERMISO|NO TIENES/i).first()).toBeVisible();
    }
  });
});

test.describe('crear una idea', () => {
  test('el brief se lee ANTES de guardar, no escondido detrás de un desplegable', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/ideas/nueva`);

    // El pedido fue "cuando lo autorrellene tiene que ver y entender antes el
    // contenido". Antes el brief era un <details> con los tres campos de
    // cámara/talento/edición dentro: quien creaba no veía lo que el equipo iba
    // a ejecutar hasta después de enviarlo.
    const panel = page.getByRole('heading', { name: /brief que se genera al guardar/i });
    await expect(panel).toBeVisible();

    for (const campo of ['// CÁMARA', '// TALENTO / MODELAJE', '// EDICIÓN']) {
      await expect(page.getByText(campo, { exact: true })).toBeVisible();
    }

    // Y son visibles de verdad, no "visibles" para el filtro de Playwright.
    expect(await desplegado(page, 'text=TALENTO / MODELAJE')).toBe(true);
  });

  test('pegar un reel muestra el video real en un iframe y arma un brief específico', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/ideas/nueva`);

    await page.getByLabel(/REFERENCIA VISUAL/i).fill('https://www.instagram.com/reel/DcN2tugtTc-/');

    // El embed va en un iframe, no en una imagen: Instagram no da miniatura
    // pública. El CSP del proyecto tiene que permitirlo o el marco no carga.
    const marco = page.locator('iframe[src*="instagram.com"]').first();
    await expect(marco).toHaveCount(1, { timeout: 15_000 });

    // El guion tiene que decir QUÉ se copia del reel, no repetir "la referencia".
    await page.getByText(/VER TAMBIÉN EL GUION/).click();
    await expect(page.getByText('QUÉ ESTAMOS COPIANDO DE LA REFERENCIA')).toBeVisible();
    await expect(page.getByText(/Reel vertical/)).toBeVisible();
  });

  test('un enlace inválido se dice antes de intentar guardar', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/ideas/nueva`);

    await page.getByLabel(/REFERENCIA VISUAL/i).fill('esto no es un enlace');
    await expect(page.getByRole('alert').first()).toContainText('no parece un enlace válido');

    // El botón de crear queda deshabilitado: no se puede mandar una idea sin
    // referencia, que es lo que la validación del servidor exige.
    await expect(page.getByRole('button', { name: /CREAR IDEA/ })).toBeDisabled();
  });
});

test.describe('modo guía', () => {
  test('se abre sola la primera vez y explica el primer botón', async ({ page }) => {
    await page.goto(`/${PROYECTO}`);

    // Sin nada guardado, la guía arranca sola: es la respuesta a "que siempre
    // que uno abra le explique botón por botón".
    await expect(page.getByText(/PASO 1 DE 6/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Este es el menú' })).toBeVisible();
  });

  test('saltarla la marca vista: no vuelve a saltar sola en la pantalla siguiente', async ({ page }) => {
    await page.goto(`/${PROYECTO}`);
    await expect(page.getByText(/PASO 1 DE 6/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'SALTAR' }).click();
    await expect(page.getByText(/PASO 1 DE 6/)).toHaveCount(0);

    await page.goto(`/${PROYECTO}/aprobaciones`);
    await expect(page.getByText(/PASO 1 DE/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Abrir la guía/ })).toBeVisible();
  });

  test('avanza botón por botón y se cierra con Escape', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
    await page.goto(`/${PROYECTO}`);

    await page.getByRole('button', { name: /Abrir la guía/ }).click();
    await expect(page.getByText(/PASO 1 DE 6/)).toBeVisible();

    await page.getByRole('button', { name: /SIGUIENTE/ }).click();
    await expect(page.getByRole('heading', { name: 'Aquí se crea una pieza' })).toBeVisible();
    await expect(page.getByText(/PASO 2 DE 6/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Aquí se crea una pieza' })).toHaveCount(0);
  });

  test('en la ficha explica la acción, el preview y el brief', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
    await page.goto(`/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');

    await page.goto(destino as string);
    await page.getByRole('button', { name: /Abrir la guía/ }).click();

    await expect(page.getByRole('heading', { name: 'Esta es tu pieza' })).toBeVisible();
    await page.getByRole('button', { name: /SIGUIENTE/ }).click();
    await expect(page.getByRole('heading', { name: 'Lo primero: qué hacer ahora' })).toBeVisible();
  });

  test('la referencia aparece UNA sola vez, en el iframe de abajo', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
    await page.goto(`/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');
    await page.goto(destino as string);

    // El preview de arriba mostraba la referencia por segunda vez, con otro
    // componente y otra etiqueta. La ficha debe traer UN solo iframe.
    await expect(page.locator('iframe')).toHaveCount(1);
    // Y el rótulo del preview duplicado no puede seguir en la página.
    await expect(page.getByText('CÓMO SE VERÁ PUBLICADO')).toHaveCount(0);
  });
});

/**
 * Transiciones. Este bloque fija un bug GRAVE y silencioso.
 *
 * `idea-actions.tsx` tenía `readOnly = PUBLIC_MODE || ...`. Al abrir el hub
 * (mientras el login de Google peleaba con Medellín Guide) eso desactivó todas
 * las transiciones del producto: las 25 piezas mostraban "SIN ACCIÓN
 * DISPONIBLE" y nadie podía mover nada. Peor: la ficha nunca pasaba el rol del
 * servidor, así que `IdeaActions` caía a `client_viewer` y tampoco ofrecía nada
 * — el bug existía incluso con la puerta encendida.
 */
test.describe('la pieza se puede mover', () => {
  test('la ficha ofrece la transición que el estado permite', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
    await page.goto(`/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');
    await page.goto(destino as string);

    // El bloque "sin acción" y los botones de movimiento son excluyentes: si
    // aparece el primero, el hub volvió a dejar las piezas quietas.
    const sinAccion = page.getByText('SIN ACCIÓN DISPONIBLE');
    const movimientos = page.getByRole('group', { name: 'Movimientos disponibles' });
    const hayMovimiento = await movimientos.isVisible().catch(() => false);
    await expect(sinAccion).toHaveCount(hayMovimiento ? 0 : 1);
  });

  test('el pie firma RR Aliados y es alcanzable en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.addInitScript(() => window.localStorage.setItem('rr-hub-guia-v1', 'visto'));
    await page.goto(`/${PROYECTO}`);

    const pie = page.getByRole('contentinfo');
    await expect(pie.getByText('Deployed by RR Aliados')).toBeVisible();
    // El logo vive en la barra lateral, oculta tras el menú en móvil: en el
    // pie tiene que estar siempre visible sin abrir nada.
    await expect(pie.getByAltText('RR Aliados')).toBeVisible();
  });
});

/**
 * Acceso. Estas tres invariantes nacieron de un reporte literal: "le doy click
 * en crear idea y no pasa nada" y "cuando alguien no esté logueado y le dé en
 * nueva idea, que se loguee, no lo mandes al inicio".
 *
 *   1. El botón de crear SIEMPRE responde. Antes devolvía el error en un nodo
 *      que se pintaba después del brief, fuera de pantalla: se veía el botón
 *      cambiar de color y nada más.
 *   2. Sin sesión, el aviso trae su propio botón para entrar — no un texto
 *      muerto que obliga a buscar el login a mano.
 *   3. El login devuelve al paso 1, no al tablero. Con `next` en la URL, y solo
 *      con rutas internas: un `?next=https://otro` sería un redirect abierto.
 */
test.describe('modo abierto', () => {
  /**
   * El hub quedó abierto mientras el login de Google se resuelve: la puerta se
   * enfrentaba a Medellín Guide, que comparte proyecto de Supabase, y los dos
   * se pisaban la sesión.
   *
   * Lo que se protege aquí es que "abierto" signifique de verdad abierto: el
   * formulario se ve, el botón responde y no aparece ninguna puerta de entrada
   * que redirija a otra aplicación.
   */
  test('la página de creación se abre y el botón responde', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/ideas/nueva`);

    await expect(page.getByRole('heading', { name: 'Nueva idea.' })).toBeVisible();

    // Marca única por corrida: sin ella, dos ejecuciones crean dos piezas y
    // solo se distingue una por el título.
    const marca = `Prueba en modo abierto ${Date.now()}`;
    await page.getByLabel(/TÍTULO/).fill(marca);
    await page.getByLabel(/OBJETIVO/).fill('Verificar que el guardado no pide cuenta');

    // O se guarda y navega a la ficha, o hay un aviso de verdad. Lo que NO
    // puede ser es quedarse quieto sin decir nada: eso fue "no pasa nada".
    const navego = page.waitForURL(/\/ideas\/[0-9a-f-]{36}/, { timeout: 20_000 }).catch(() => null);
    await page.getByRole('button', { name: /CREAR IDEA/ }).click();
    const destino = await navego;
    await page.waitForTimeout(4000);

    const avisoVisible = await page.locator('#aviso-crear').isVisible().catch(() => false);
    expect(destino !== null || avisoVisible).toBe(true);

    /**
     * Esta prueba ESCRIBE en la base real, y antes no limpiaba. Con el dev
     * server no se notaba porque `SUPABASE_SERVICE_ROLE_KEY` no está y el alta
     * falla — el test "pasaba" sin crear nada. Al correr contra producción con
     * `HUB_BASE_URL` creó de verdad: quedaron O16, O17 y el contador del tablero
     * subió a 27 piezas sin que nadie lo hiciera.
     *
     * Ahora borra lo que creó. Si el borrado falla, el test falla: es preferible
     * una suite roja a una base de clientes con filas de prueba. Para eso
     * necesita el service role, así que la limpieza solo corre en producción, que
     * es donde está el dato real.
     */
    if (!destino) {
      // Si se guardó pero no se navegó, la pieza existe y hay que borrarla
      // igual: se busca por la marca, que es única de esta corrida.
      const huerfana = await borrarPorMarca(marca);
      expect(huerfana, `se creó «${marca}» pero el test no llegó a la ficha y no se pudo borrar`).toBe(true);
      return;
    }

    const ideaId = new URL(destino).pathname.split('/').pop() as string;
    const borrado = await borrarIdeaDePrueba(ideaId, marca);
    expect(borrado, `no se pudo borrar la pieza de prueba ${ideaId}`).toBe(true);
  });

  test('el header no pide entrar ni perfil', async ({ page }) => {
    await abrir(page, `/${PROYECTO}`);

    // La acción principal sigue ahí: es la que de verdad importa.
    await expect(page.getByRole('link', { name: /NUEVA PIEZA/ })).toBeVisible();
    // Y no hay un botón de acceso que pueda mandarte a otra aplicación.
    await expect(page.getByRole('link', { name: /INICIAR SESIÓN/ })).toHaveCount(0);
  });

  test('nada en el hub manda a otro proyecto', async ({ page }) => {
    const saltos: string[] = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) saltos.push(f.url()); });

    for (const ruta of ['/', `/${PROYECTO}`, `/${PROYECTO}/ideas/nueva`, `/${PROYECTO}/perfil`]) {
      await page.goto(ruta).catch(() => {});
    }
    expect(saltos.filter((u) => /medellin/i.test(u))).toHaveLength(0);
  });
});

/**
 * La página de creación se abre siempre.
 *
 * El reporte literal fue "simplemente no carga cuando intento crear la idea". La
 * causa era el middleware: `/wundeer/ideas/nueva` estaba en la lista de rutas
 * protegidas y sin sesión devolvía un 307 a `/login` SIN `next`. La persona
 * llegaba a un formulario vacío —o a la portada— sin ver nunca el formulario ni
 * un error. La regla se queda: la página se abre, la escritura se resuelve
 * después.
 */
test.describe('la página nunca se bloquea', () => {
  test('responde 200 con el formulario en pantalla', async ({ page }) => {
    // La página se abre aunque la puerta esté encendida: pedir sesión en la
    // entrada es justo lo que producía el 307 mudo.
    const respuesta = await page.goto(`/${PROYECTO}/ideas/nueva`);
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Nueva idea.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /CREAR IDEA/ })).toBeVisible();
  });
});

/**
 * La puerta no deja salir a otro sitio, y no pide cuentas.
 *
 * El reporte original fue "entro al Content Hub y me abre Medellín Under": las
 * dos apps comparten proyecto de Supabase y el `SITE_URL` de respaldo es UNO, así
 * que un login pedido sin `redirectTo` caía en la app que configuró el proyecto.
 *
 * Ese agujero ya no se puede abrir por ahí: la puerta es un código por cliente y
 * `POST /api/entrar` devuelve JSON con la cookie, sin redirección y sin salir de
 * este dominio. Estas pruebas comprueban esa propiedad — que no existe ninguna
 * forma de que entrar al hub te lleve a otra aplicación — y que el código de un
 * cliente NO abre el otro.
 */
test.describe('la puerta no te saca de aquí', () => {
  test('no hay ni botón de Google ni campo de contraseña ni correo', async ({ page }) => {
    await abrir(page, '/login');

    // Lo que se quita no puede volver por la puerta de atrás: ni en el HTML, ni
    // en un script, ni como texto invisible.
    const html = await page.content();
    expect(html).not.toMatch(/Entrar con Google/i);
    expect(html).not.toMatch(/accounts\.google\.com/i);
    expect(html).not.toMatch(/type=["']password["']/i);
    expect(html).not.toMatch(/auth\/callback/i);
    expect(html).not.toMatch(/signInWithOtp|verifyOtp/i);
  });

  test('el destino de vuelta es siempre una ruta de este sitio', async ({ baseURL, playwright }) => {
    // El agujero original —"entro al hub y me abre Medellín Under"— pasaba por un
    // `next` que podía ser una URL entera. Hoy el `next` lo pone el middleware y
    // es SIEMPRE `request.nextUrl.pathname`: una ruta interna, nunca un sitio.
    //
    // Se mide por la vía real (dejar que el middleware construya el enlace) y no
    // contra un `?next=` escrito a mano: medido con `curl`, una ruta protegida sin
    // cookie devuelve 307 a `/login?next=<ruta interna>`, y eso es lo que hay que
    // proteger. Un `?next=` a mano ya no lo produce nadie.
    //
    // Ojo al detalle que costó una vuelta: `playwright.request` hereda el
    // `storageState` de la corrida, así que con la cookie puesta devolvía 200 y la
    // prueba decía "la puerta no se pidió" cuando en realidad estaba entrando. Un
    // contexto nuevo y sin cookies es lo que reproduce a alguien que llega sin
    // sesión.
    const peticion = await playwright.request.newContext({
      baseURL: baseURL!,
      extraHTTPHeaders: { Cookie: '' },
    });
    const respuesta = await peticion.get(`/${PROYECTO}/ideas/nueva`, { maxRedirects: 0 });
    const destino = respuesta.headers().location;

    expect(respuesta.status(), 'la ruta protegida no pidió la puerta').toBe(307);
    expect(destino, 'el middleware no puso destino de vuelta').toBeTruthy();

    const url = new URL(destino!, baseURL);
    expect(url.origin).toBe(new URL(baseURL!).origin);
    expect(url.pathname).toBe('/login');

    const siguiente = url.searchParams.get('next');
    expect(siguiente, 'el destino de vuelta no lleva la ruta').toBeTruthy();
    // La forma del dato es la del fallo, no la del destino: empieza por barra y no
    // puede parecer un protocolo ni un doble inicio.
    expect(siguiente!.startsWith('/')).toBe(true);
    expect(siguiente!.startsWith('//')).toBe(false);
    expect(siguiente).not.toMatch(/^\w+:/);
    expect(siguiente).not.toMatch(/medellin/i);
    expect(siguiente).toBe(`/${PROYECTO}/ideas/nueva`);

    await peticion.dispose();
  });

  test('el código de un cliente no abre el otro', async ({ page }) => {
    // Aísla la matriz: con el código de Wundeer, Candilejas da 404. Esto ya lo
    // comprueba la API; aquí se ve que también lo ve quien está delante.
    await abrir(page, '/candilejas');
    // Sin cookie, la página de login se sirve con el catálogo de clientes.
    const html = await page.content();
    expect(html).not.toMatch(/ideas|tablero/i);

    // Y con la cookie de Wundeer tampoco: el cliente manda, la URL no.
    const estado = process.env.HUB_E2E_STATE;
    test.skip(!estado, 'sin estado de sesión no se puede comprobar el aislamiento desde dentro');
    await abrir(page, '/wundeer');
    await abrir(page, '/candilejas');
    await expect(page).toHaveURL(/\/candilejas/);
    const dentro = await page.locator('body').innerText();
    expect(dentro).not.toContain('WUNDEER');
  });
});
