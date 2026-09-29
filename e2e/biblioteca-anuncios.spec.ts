import { expect, test } from '@playwright/test';

/**
 * La biblioteca de anuncios, conectada al alta de ideas.
 *
 * Qué se protege aquí, y por qué esta prueba existe:
 *
 * La biblioteca se armó en la base pero el componente que la mostraba se perdió
 * (quedó solo en un stash de otra sesión). La columna `ad_id` sí sobrevivió, y
 * por eso era peligroso: el sistema parecía completo y no lo estaba.
 *
 * Las reglas que se comprueban, en orden de importancia:
 *   1. La zona de la biblioteca SIEMPRE es visible. Ni con lista vacía: un
 *      botón que desaparece sin explicar por qué se lee como función rota, y la
 *      primera causa fue RLS devolviendo 0 filas en silencio.
 *   2. Con anuncios, se abre y busca.
 *   3. Al elegir, se rellena la REFERENCIA (lo que se fue a buscar).
 *   4. Al elegir, NO se pisa el título si la persona ya escribió uno. Un
 *      selector que pisa lo escrito es un selector que nadie usa dos veces.
 *
 * Solo lectura: no guarda la idea, así que no deja basura. El guardado con
 * `ad_id` se cubre en `hub.spec.ts`, que sí crea y borra.
 */

const PROYECTO = 'wundeer';
// Candilejas no tiene anuncios cargados: es el escenario de biblioteca vacía.
const PROYECTO_SIN_ANUNCIOS = 'candilejas';
const BOTON_BIBLIOTECA = /BIBLIOTECA DE ANUNCIOS|ELEGIR UN ANUNCIO DE LA BIBLIOTECA/i;
const SIN_SESION = 'requiere sesión: las políticas RLS de la biblioteca exigen rol authenticated';

test.describe('biblioteca de anuncios en el alta', () => {
  test('la zona de la biblioteca se ve aunque el proyecto no tenga anuncios', async ({ page }) => {
    // Candilejas es otro cliente con otro código: el estado de sesión guardado es
    // del cliente que lo exportó, y una cookie de Wundeer da 404 en Candilejas a
    // propósito. Sin `HUB_E2E_STATE_CANDILEJAS` este recorrido no puede probarse,
    // y se salta diciendo por qué en vez de fingir que la biblioteca está vacía.
    test.skip(
      !process.env.HUB_E2E_STATE_CANDILEJAS,
      'hace falta una sesión de Candilejas (HUB_E2E_STATE_CANDILEJAS) para ver su biblioteca vacía',
    );
    // El caso vacío ya no es el de Wundeer: hay 30 anuncios reales y se leen por
    // el servidor. Lo que se protege aquí es el otro extremo — que el hueco
    // NO se esconda cuando el catálogo viene vacío — y para eso hace falta un
    // proyecto sin anuncios. Candilejas no tiene ninguno, así que su alta es el
    // escenario honesto de la biblioteca vacía.
    await page.goto(`/${PROYECTO_SIN_ANUNCIOS}/ideas/nueva`);

    const zona = page.getByRole('button', { name: BOTON_BIBLIOTECA }).first();
    await expect(zona).toBeVisible();
    await expect(page.getByText(/todavía no hay anuncios cargados/i)).toBeVisible();

    // Y el motivo explica qué hacer, no solo que falta.
    await expect(page.getByText(/pegar la referencia a mano/i)).toBeVisible();
  });

  test('con anuncios: se abre, busca, y rellena la referencia', async ({ page }) => {
    test.skip(!process.env.HUB_E2E_AUTH, SIN_SESION);

    await page.goto(`/${PROYECTO}/ideas/nueva`);
    await page.getByRole('button', { name: BOTON_BIBLIOTECA }).click();

    const buscador = page.getByRole('searchbox', { name: /biblioteca de anuncios/i });
    await expect(buscador).toBeVisible();
    expect(await page.locator('li button').count()).toBeGreaterThan(0);

    const campoReferencia = page.getByLabel(/REFERENCIA VISUAL/i);
    expect(await campoReferencia.inputValue()).toBe('');
    await page.locator('li button').first().click();
    await expect(campoReferencia).not.toHaveValue('');
    await expect(buscador).toBeHidden();
  });

  test('con anuncios: el buscador filtra, y no pisa un título escrito', async ({ page }) => {
    test.skip(!process.env.HUB_E2E_AUTH, SIN_SESION);

    await page.goto(`/${PROYECTO}/ideas/nueva`);
    await page.getByRole('button', { name: BOTON_BIBLIOTECA }).click();

    const buscador = page.getByRole('searchbox', { name: /biblioteca de anuncios/i });
    const todos = await page.locator('li button').count();
    expect(todos).toBeGreaterThan(0);

    await buscador.fill('zzzz-no-existe-zzz');
    await expect(page.getByText(/Nada con/i)).toBeVisible();
    expect(await page.locator('li button').count()).toBe(0);

    await buscador.fill('');
    expect(await page.locator('li button').count()).toBe(todos);

    // Y lo más importante: no pisa lo que la persona escribió.
    await page.getByLabel(/T[ÍI]TULO/i).first().fill('Un título que escribí yo');
    await page.locator('li button').first().click();
    await expect(page.getByLabel(/T[ÍI]TULO/i).first()).toHaveValue('Un título que escribí yo');
  });
});
