import { expect, test } from '@playwright/test';

/**
 * Recorridos de lectura sobre el hub real.
 *
 * Qué se protege aquí: las cuatro invariantes que se rompieron de verdad y que
 * ninguna prueba de tipos iba a notar.
 *   1. Una sola acción por superficie (llegaron a convivir 14 botones y 3 CTA).
 *   2. La cola abre por lo que más lleva parado (llegó a ordenar por código y
 *      enterrar una pieza de 15 días entre las de ayer).
 *   3. El roadmap no clona el mismo avance en las tres pistas (daban las tres 78%).
 *   4. Ninguna pantalla promete datos que la base no tiene.
 *
 * NO escribe en la base: son navegaciones y lecturas. Una prueba que mueva una
 * pieza estaría tocando datos de clientes en producción.
 */

const PROYECTO = 'wundeer';

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
    await page.getByLabel('Buscar piezas').fill('macro');
    const contador = page.locator('text=/PIEZAS ·/').first();
    await expect(contador).toContainText('/25');
    await expect(contador).not.toContainText('25/25');

    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(contador).toContainText('25/25');
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
  test('la acción está arriba y a un visitante no se le ofrece mover la pieza', async ({ page }) => {
    await abrir(page, `/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');
    expect(destino, 'la cola debería traer al menos una pieza').toBeTruthy();

    await page.goto(destino as string);

    // El panel de acción va en el primer pantallazo (antes vivía al final).
    await expect(page.getByText(/TU SIGUIENTE ACCIÓN/)).toBeInViewport();

    // Y el rol lo decide el servidor: sin sesión no hay transición que ofrecer.
    // Esto protege de que alguien vuelva a cablear `activeRole = 'owner'` en el
    // navegador, que es lo que hacía mi línea antes del merge.
    await expect(page.getByRole('button', { name: /APROBAR IDEA|SOLICITAR AJUSTES|ARCHIVAR PROPUESTA/ })).toHaveCount(0);
    await expect(page.getByText('SIN ACCIÓN DISPONIBLE')).toBeVisible();
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
  test('el panel de administración no enseña el roster sin sesión', async ({ page }) => {
    // Con la autenticación apagada la línea devuelve 404: ni confirma que la
    // ruta existe. Con la encendida, el middleware manda a /login indicando a
    // dónde volver. Las dos respuestas sirven; lo que no puede pasar es que el
    // roster aparezca. Esta prueba corre con la variable que imponga cada modo.
    await page.goto('/audit/admin');

    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
    expect(texto).not.toContain('US10');
    // Y nunca queda mostrando el panel a alguien sin sesión.
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true') {
      await expect(page).toHaveURL(/\/login\?next=%2Faudit%2Fadmin/);
    } else {
      expect(page.url()).toContain('/audit/admin');
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

    await page.getByLabel(/TÍTULO/).fill('Prueba en modo abierto');
    await page.getByLabel(/OBJETIVO/).fill('Verificar que el guardado no pide cuenta');

    // O se guarda y navega a la ficha, o hay un aviso de verdad. Lo que NO
    // puede ser es quedarse quieto sin decir nada: eso fue "no pasa nada".
    const navego = page.waitForURL(/\/ideas\/[0-9a-f-]{36}/, { timeout: 20_000 }).catch(() => null);
    await page.getByRole('button', { name: /CREAR IDEA/ }).click();
    const [, destino] = await Promise.all([navego, page.waitForTimeout(4000)]);

    const avisoVisible = await page.locator('#aviso-crear').isVisible().catch(() => false);
    expect(destino !== null || avisoVisible).toBe(true);
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
 * El OAuth no debe poder sacar a la persona de este sitio.
 *
 * El reporte fue "entro al Content Hub y me abre Medellín Under". Las dos apps
 * comparten proyecto de Supabase y cliente de Google, así que Supabase tiene UN
 * destino de respaldo. Si el login se pide sin `redirectTo`, vuelve ahí — y
 * "ahí" es la app que configuró el proyecto, no la que la persona eligió.
 *
 * Estas pruebas siguen en pie aunque hoy la puerta esté apagada: el login y el
 * callback siguen en el código, y vuelven con `NEXT_PUBLIC_AUTH_ENABLED=true`.
 * Lo que se protege es que, cuando la puerta se encienda, no reintroduzca el
 * salto a la otra aplicación.
 */
test.describe('el login no se va a otra app', () => {
  test('el botón de Google pide el callback, nunca el destino final', async ({ page }) => {
    await abrir(page, `/login?next=${encodeURIComponent(`/${PROYECTO}/ideas/nueva`)}`);

    // Se intercepta la navegación a Google para ver qué URL se pidió.
    const pedido = page.waitForRequest(/accounts\.google\.com/, { timeout: 15_000 }).catch(() => null);
    await page.getByRole('button', { name: /Entrar con Google/i }).click();
    const url = (await pedido)?.url() ?? page.url();
    const destino = new URL(url).searchParams.get('redirect_to') ?? '';

    // Al callback, con el paso 1 en `next`.
    expect(destino).toContain('/auth/callback');
    expect(destino).toContain(encodeURIComponent(`/${PROYECTO}/ideas/nueva`));

    // Y nunca a otro proyecto: ni al sitio de la otra app, ni fuera de aquí.
    // El host se compara contra el del hub leído ANTES de pulsar: cuando se pide
    // el login, el navegador ya navegó a Google y `page.url()` no sirve.
    await abrir(page, `/login`);
    const hostHub = new URL(page.url()).hostname;
    expect(new URL(destino).hostname).toBe(hostHub);
    expect(destino).not.toMatch(/medellin/i);
  });

  test('el callback rechaza un next de otro sitio', async ({ page }) => {
    await abrir(page, `/auth/callback?next=${encodeURIComponent('https://medellin-guide.vercel.app')}`);

    // Sin `code` no hay intercambio de sesión, pero tampoco debe redirigir
    // fuera: vuelve al login, que es de este proyecto.
    await expect(page).toHaveURL(/\/login\?/);
    expect(page.url()).not.toContain('medellin-guide');
  });
});
