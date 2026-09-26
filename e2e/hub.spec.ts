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

test.describe('tablero', () => {
  test('una sola acción para crear y ningún hueco vacío', async ({ page }) => {
    await page.goto(`/${PROYECTO}`);

    // Una sola puerta para crear: la regla que quitó 13 botones y 2 CTA de más.
    await expect(page.locator('a[href$="/ideas/nueva"]:visible')).toHaveCount(1);

    await expect(page.getByText('TOCA UN PASO PARA FILTRAR')).toBeVisible();

    // El hueco punteado que se veía en 17 de 26 tarjetas ya no existe.
    await expect(page.getByText('SIN MINIATURA · ABRIR')).toHaveCount(0);

    for (const pista of PISTAS) {
      await expect(page.getByText(pista, { exact: true }).first()).toBeVisible();
    }
  });
});

test.describe('colas', () => {
  test('la cola abre por lo que más lleva parado', async ({ page }) => {
    await page.goto(`/${PROYECTO}/aprobaciones`);
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
    await page.goto(`/${PROYECTO}/metricas`);
    await expect(page.getByText('MEDICIÓN TODAVÍA SIN BASE')).toBeVisible();

    await page.goto(`/${PROYECTO}/publicaciones`);
    await expect(page.getByText('MISMA PANTALLA QUE MÉTRICAS')).toBeVisible();
  });
});

test.describe('ficha de pieza', () => {
  test('la acción primaria está en el primer pantallazo', async ({ page }) => {
    await page.goto(`/${PROYECTO}/aprobaciones`);
    const destino = await page.locator('a.idea-card').first().getAttribute('href');
    expect(destino, 'la cola debería traer al menos una pieza').toBeTruthy();

    await page.goto(destino as string);

    // Antes la acción vivía al final de la página, a dos pantallas de scroll.
    const accion = page.locator('main button.btn-brutal').first();
    await expect(accion).toBeInViewport();
  });
});

test.describe('roadmap', () => {
  test('las tres pistas no muestran el mismo avance', async ({ page }) => {
    await page.goto(`/${PROYECTO}/roadmap`);

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
  test('el panel de administración no filtra datos del equipo sin sesión', async ({ page }) => {
    await page.goto('/audit/admin');

    // Sirve la página de guarda, no el panel.
    await expect(page.getByText(/RESTRINGIDO/)).toBeVisible();

    // Y en el texto servido no hay ni un solo correo (ni rol, ni id de DashWeb).
    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
    expect(texto).not.toContain('US10');
  });
});
