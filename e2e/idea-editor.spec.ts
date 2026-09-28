import { test, expect } from '@playwright/test';

const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

/** Pieza REAL sin referencia: O13, `draft`. */
const SIN_REFERENCIA = '40e36f4b-645c-4a8c-88ef-37ef3d14b699';
/** Pieza REAL con referencia: O10. */
const CON_REFERENCIA = '27fe6119-b7b6-4409-8aeb-0ae419d574ae';

/**
 * El editor de una pieza que ya existe.
 *
 * Nació del reporte: "la de prueba no tiene referencia y no puedo editarla para
 * poner el link". Eso era dos huecos a la vez — no había forma de corregir una
 * idea, y el bloque de referencia se leía como algo finished aunque faltara.
 *
 * Lo que se protege, y son tres cosas que se rompen por separado:
 * 1. El botón DISTINGUE los dos casos y dice cuál. Un editor genérico que no
 *    dice qué falta repite el mismo reporte disfrazado de "¿cuál es el campo?".
 * 2. Al editar, la referencia actual viene cargada. Si el campo aparece vacío,
 *    no sabes qué vas a cambiar: pareces estar borrando algo.
 * 3. El aviso de error va ARRIBA del formulario y se lee. Este bloque nació del
 *    reporte "le doy a guardar y no pasa nada".
 */
test('el botón dice qué falta según la pieza', async ({ page }) => {
  await page.addInitScript(visto);

  await page.goto(`/wundeer/ideas/${SIN_REFERENCIA}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'AÑADIR REFERENCIA' })).toBeVisible();
  // El aviso lo dice con palabras, no lo deja deducir del hueco.
  await expect(page.getByText(/le falta la referencia visual/i)).toBeVisible();
  console.log('[sin referencia] botón "AÑADIR REFERENCIA" + texto que avisa');

  await page.goto(`/wundeer/ideas/${CON_REFERENCIA}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'EDITAR DATOS' })).toBeVisible();
  console.log('[con referencia] botón "EDITAR DATOS"');
});

test('al editar, la referencia actual viene cargada', async ({ page }) => {
  await page.addInitScript(visto);
  await page.goto(`/wundeer/ideas/${CON_REFERENCIA}`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'EDITAR DATOS' }).click();
  const campo = page.locator('#edit-referencia');
  await expect(campo).toBeVisible();
  await expect(campo).toHaveAttribute('type', 'url');

  const valor = await campo.inputValue();
  console.log(`[campo] "${valor.slice(0, 58)}"`);
  expect(valor).toContain('drive.google.com');

  // Y la referencia va antes que el título: es lo que más falta.
  const orden = await page.evaluate(() => {
    const y = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : Infinity;
    };
    return { ref: y('#edit-referencia'), titulo: y('#edit-titulo') };
  });
  console.log(`[orden] referencia y=${orden.ref}, título y=${orden.titulo}`);
  expect(orden.ref).toBeLessThan(orden.titulo);
});

test('un link roto da un aviso visible arriba', async ({ page }) => {
  await page.addInitScript(visto);
  await page.goto(`/wundeer/ideas/${SIN_REFERENCIA}`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'AÑADIR REFERENCIA' }).click();
  await page.locator('#edit-referencia').fill('no-es-un-link');
  await page.getByRole('button', { name: /GUARDAR CAMBIOS/ }).click();

  const aviso = page.locator('#aviso-editar');
  await expect(aviso).toBeVisible({ timeout: 5000 });
  const texto = (await aviso.textContent()) ?? '';
  console.log(`[aviso] "${texto.trim()}"`);
  // Se compara en minúsculas y sin acentos para que la prueba no dependa de la
  // tilde: lo que importa es que el aviso DIGA que la dirección no vale.
  //
  // El texto se contrasta contra lo que el componente DICE de verdad, no contra
  // una frase inventada en la prueba. La primera versión buscaba "no es una
  // direccion valida" y el aviso dice "la direccion de la referencia no es
  // valida": dos palabras de diferencia y la prueba fallaba por eso, no porque
  // faltara el aviso.
  const sinAcentos = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  console.log(`[aviso normalizado] "${sinAcentos.trim()}"`);
  expect(sinAcentos).toContain('no es valida');
  expect(sinAcentos).toContain('https://');

  const arriba = await page.evaluate(() => {
    const a = document.querySelector('#aviso-editar');
    const f = document.querySelector('#edit-referencia');
    if (!a || !f) return false;
    return a.getBoundingClientRect().top + window.scrollY <
           f.getBoundingClientRect().top + window.scrollY;
  });
  expect(arriba, 'el aviso debe ir ARRIBA del formulario').toBe(true);
});

test('el editor se lee en el teléfono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(visto);
  await page.goto(`/wundeer/ideas/${SIN_REFERENCIA}`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'AÑADIR REFERENCIA' }).click();
  await expect(page.locator('#edit-referencia')).toBeVisible();

  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  console.log(`[movil] desborde ${desborde} px`);
  expect(desborde).toBeLessThanOrEqual(0);
});
