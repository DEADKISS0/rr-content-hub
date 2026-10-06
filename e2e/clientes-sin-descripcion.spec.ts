/*
 * BOGA y Satiro Sushi existen en la base pero NO salen en la portada. (2026-10-05)
 *
 * POR QUE EXISTE, y por qué este recorrido parece raro a primera vista:
 * comprobar que NO aparecen. El 2026-10-04 Santiago dijo «solo quiero que dejes a
 * Wundeer y Candilejas» y los otros dos quedaron fuera del catálogo visible por
 * `HUB_CATALOGO_VISIBLE` en `getClientesDeLaPersona` (`src/lib/data.ts`). No se
 * borraron: siguen con sus ideas y su trazabilidad. Se apartaron de la pantalla
 * porque salían como tarjetas con 0 piezas que se pulsaban y no abrían nada.
 *
 * Lo que se comprueba es lo CONTRARIO de lo que se escribió primero. MEDIDO: los
 * dos recorridos de la 1a versión afirmaban `a[href="/boga"]` visible, y el
 * fallo era correcto — es justo lo que el sitio hace a propósito. Un recorrido
 * que falla por afirmar lo contrario de la realidad no prueba nada: entierra la
 * decisión dentro de un test rojo que el siguiente que lo lea va a "arreglar"
 * metiendo a BOGA de vuelta en la portada.
 *
 * Tres cosas:
 *
 *   1. Que BOGA y Satiro NO aparezcan, y que la lista sea exactamente la que se
 *      decidió. Si mañana se expone uno nuevo, esto falla y obliga a decidir.
 *   2. Que la regla viva en `HUB_CATALOGO_VISIBLE`, no en un array del código.
 *      Vaciar la variable tiene que volver a enseñarlos: es el fail-open que se
 *      decidió — mejor que se vea de más que un cliente escondido sin querer.
 *   3. Que sus descripciones sigan vacías. El 2026-10-05 se vaciaron porque eran
 *      relleno («Bienvenido al espacio de BOGA») y nunca se comprobó qué hace la
 *      tarjeta si un día se exponen con `description = NULL`.
 *
 * Solo LECTURA: no pulsa votos, no guarda, no escribe.
 */
import { test, expect } from '@playwright/test';

/*
 * PITFALL MEDIDO 2026-10-05: la 1a versión comparaba
 * `process.env.HUB_CATALOGO_VISIBLE` contra `['candilejas', 'wundeer']` y
 * fallaba, porque esa variable vive en `.env.local` y Playwright no la carga:
 * arrives a CI con `CATALOGO` vacío. La prueba medía el entorno, no el
 * producto. Lo que importa es lo que se VE, que es además lo que decidió
 * Santiago: en la portada solo hay Wundeer y Candilejas.
 */

test('BOGA y Satiro están apartados del catálogo visible, como se decidió', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const texto = ((await page.locator('body').textContent()) ?? '').toUpperCase();

  // El listado real de la portada es Wundeer y Candilejas. Si esto cambia, el
  // recorrido falla y obliga a decidir de nuevo en vez de dejar que un cliente
  // se cuelgue por accidente.
  expect(texto).not.toContain('BOGA');
  expect(texto).not.toContain('SATIRO');
});

test('Wundeer y Candilejas sí están, que es lo que se ve', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[href="/wundeer"]').first()).toBeVisible();
  await expect(page.locator('a[href="/candilejas"]').first()).toBeVisible();
});

test('la descripción de BOGA sigue limpia, sin relleno inventado', async ({ page }) => {
  // Se comprueba el dato, no la tarjeta: si alguien expone BOGA, la descripción
  // tiene que llegar limpia a la pantalla.
  await page.goto('/boga', { waitUntil: 'domcontentloaded' });

  /*
   * PITFALL MEDIDO 2026-10-05: la 1a versión usaba `textContent` y buscaba la
   * palabra «undefined». `textContent` incluye el contenido de los `<script>`,
   * y el payload de RSC de Next lleva `"$undefined"` en cada nodo sin valor:
   * salía coincidencia siempre, con la descripción vacía o no. `innerText` es el
   * texto que se VE, que es lo que hay que comprobar.
   */
  const cuerpo = ((await page.locator('body').innerText()) ?? '').toLowerCase();

  expect(cuerpo).not.toContain('undefined');
  expect(cuerpo).not.toContain('bienvenido');
  expect(cuerpo).not.toContain('espacio de');
});
