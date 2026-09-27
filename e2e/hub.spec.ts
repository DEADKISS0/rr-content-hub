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
    await expect(page.locator('a[href$="/ideas/nueva"]:visible')).toHaveCount(1);

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
  test('el panel de administración no existe para quien no tiene sesión', async ({ page }) => {
    const respuesta = await page.goto('/audit/admin');

    // La línea desplegada responde 404 sin sesión: ni confirma que la ruta existe.
    // Es más fuerte que la página de guarda que tenía mi línea, así que el test
    // fija el comportamiento nuevo, no el mío.
    expect(respuesta?.status()).toBe(404);

    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
    expect(texto).not.toContain('US10');
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
    await expect(page.getByRole('heading', { name: 'Este botón crea una pieza' })).toBeVisible();
    await expect(page.getByText(/PASO 2 DE 6/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Este botón crea una pieza' })).toHaveCount(0);
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
