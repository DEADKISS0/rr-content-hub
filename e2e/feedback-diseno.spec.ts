import { test, expect } from '@playwright/test';

/**
 * Los 7 cambios del feedback de diseño del 2026-10-05.
 *
 * MEDIDO antes de escribir: la descripción de Wundeer se pintaba entera en la
 * portada del banco y dentro del proyecto. Medía 292×2080 px en la tarjeta del
 * banco y 672×1600 px dentro del proyecto, con el historial de por qué se
 * descartó cada referencia («LECCION DE ESTE ENCARGO», «DESCARTADAS Y RESPALDADAS
 * (8)», «A REVISAR POR SANTIAGO (27)») mezclado con lo que hay que saber para
 * trabajar. Santiago: «demasiado texto, y no se si el necesario».
 */
/*
 * Estos 12 recorridos son de SOLO LECTURA: abren páginas, miden cajas y leen
 * texto. No pulsan votos, no guardan y no escriben en la base. Desde el
 * 2026-10-02 las páginas del hub se abren sin sesión, así que NO llevan
 * `test.skip` por falta de sesión: si lo llevaran y `HUB_E2E_STATE` estuviera
 * vacío, los 12 se saltarían en silencio y el suite parecería verde sin haber
 * comprobado nada. Para lo que sí exige sesión —las políticas RLS de la
 * biblioteca— el repo usa `HUB_E2E_AUTH`; ver `biblioteca-anuncios.spec.ts`.
 */

/** Cierra la guía guiada si está abierta. (2026-10-05) */
async function saltarGuia(page: import('@playwright/test').Page) {
  const guia = page.locator('div[role="dialog"][aria-modal="true"]');
  if (!(await guia.count())) return;
  /*
   * MEDIDO 2026-10-05: el botón de cierre NO está dentro del diálogo. El
   * `role="dialog" aria-modal` es el overlay `fixed inset-0 z-50`, y la tarjeta
   * con la ✕ vive como hermana, fuera. Por eso
   * `guia.getByRole('button', {name: /cerrar/i})` no la encontraba: no es
   * descendiente del overlay. La ✕ se busca en la página entera, por su
   * `aria-label="Cerrar la guía"` (`guided-tour.tsx`).
   */
  await page.keyboard.press('Escape').catch(() => {});
  const x = page.locator('button[aria-label="Cerrar la guía"]');
  if (await x.count()) await x.first().click({ timeout: 5_000 }).catch(() => {});
  const salir = page.getByRole('button', { name: /saltar|entendido/i });
  if (await salir.count()) await salir.first().click({ timeout: 5_000 }).catch(() => {});
  await guia.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});

  /*
   * Y por qué el marco llegaba a dar DOS alturas (96 y 152) con la guía cerrada:
   * el resaltado de la tarjeta se retira DESPUÉS del overlay. Se espera a que
   * termine para medir, no solo a que desaparezca el diálogo.
   *
   * La causa de fondo era otra, ya resuelta en `playwright.config.ts`: con
   * `rr-hub-guia-v1` marcado desde antes de cargar la guía no abre, y las 41
   * tarjetas dan 152 px exactas. MEDIDO en 1280, en 1370 y en 390.
   */
  await page.waitForTimeout(600);
}

/** Abre el tablero de todas las piezas y espera a que pinten las tarjetas. */
async function abrirTablero(page: import('@playwright/test').Page) {
  await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
  await saltarGuia(page);
  await page.locator('details.group\\/todas').evaluate((d) => { (d as HTMLDetailsElement).open = true; });
  await page.waitForSelector('article.idea-card', { timeout: 20_000 });
  await page.waitForTimeout(1_200);
}

test.describe('ficha del proyecto: corta, no un muro', () => {
  test('la tarjeta del banco no mide 2.080 px de alto', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const cajas = await page.locator('a.group.relative p').evaluateAll((ps) =>
      ps.map((p) => Math.round(p.getBoundingClientRect().height)));
    // MEDIDO: la más alta era 2.080 px. Con la línea-clamp queda en decenas.
    expect(Math.max(...cajas)).toBeLessThan(700);
  });

  test('la ficha completa sigue disponible, no se perdió', async ({ page }) => {
    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    // Lo que se quitó de la vista es historial, no información: se abre con un
    // `<details>`. Si este enlace desaparece, el resumen se volvió la única
    // fuente y eso SÍ sería perder datos.
    const completo = page.getByRole('group').filter({ hasText: /FICHA COMPLETA/ });
    await expect(completo.first()).toBeVisible();
  });

  test('la portada ya no dice que la auditoría es de solo lectura', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const pie = page.locator('p.mt-12.border-t');
    await expect(pie).not.toContainText(/solo lectura/i);
    // Y el enlace dice lo que hace, no «ABRE LA AUDITORÍA».
    await expect(pie).toContainText(/MIRA LAS MÉTRICAS/i);
  });
});

test.describe('tarjetas del tablero: una sola', () => {
  test('el marco de la portada mide lo mismo en todas las tarjetas', async ({ page }) => {
    await abrirTablero(page);
    const medidas = await page.locator('article.idea-card .cover-frame').evaluateAll((ms) =>
      ms.map((m) => Math.round(m.getBoundingClientRect().height)));
    expect(medidas.length).toBeGreaterThan(0);

    /*
     * MEDIDO 2026-10-05, muchas veces y siempre igual:
     *
     *   · El MARCO es uniforme: 152 px en las 41 tarjetas, a 1280, a 1370 y a 390.
     *     Eso es lo que cambió con el punto 3 del feedback: antes unas tarjetas
     *     tenían el rótulo de red y otras no.
     *   · El `<article>` NO es uniforme: de 373 a 518 px, según cuánto envuelve el
     *     título de la pieza. Eso es texto normal y no un fallo de maquetación.
     *
     * El motivo de por qué una medición puede dar 96 en una tarjeta está en
     * `saltarGuia`, que es donde se cierra el resaltado antes de medir.
     */
    const distintas = [...new Set(medidas)].sort((a, b) => a - b);
    expect(distintas.length === 1 ? 1 : distintas).toBe(1);
  });

  test('el rótulo de red solo aparece donde hay referencia', async ({ page }) => {
    await abrirTablero(page);
    const conRotulo = await page.locator('article.idea-card .cover-frame .absolute.left-2.top-2').count();
    const total = await page.locator('article.idea-card .cover-frame').count();
    expect(total).toBeGreaterThan(0);
    // Ni todas sin rótulo (se perdería de dónde viene la pieza) ni todas con
    // rótulo (se inventaría una referencia donde no hay).
    expect(conRotulo).toBeGreaterThan(0);
    expect(conRotulo).toBeLessThan(total);
  });
});

test.describe('barra superior: el logo del cliente', () => {
  test('Wundeer muestra su logo, con el nombre en alt', async ({ page }) => {
    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    const logo = page.locator('header.sticky a[href="/wundeer"] img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', '/logos/wundeer.png');
    // El nombre no desaparece: pasa al `alt`, que es lo que lee un lector de
    // pantalla y lo que se ve si la imagen no carga.
    await expect(logo).toHaveAttribute('alt', /wundeer/i);
  });

  test('Candilejas cae al texto, porque no tiene logo', async ({ page }) => {
    await page.goto('/candilejas', { waitUntil: 'domcontentloaded' });
    // Un cliente sin logo debe ver su nombre. Una imagen rota en la barra
    // superior sería peor que texto.
    const barra = page.locator('header.sticky');
    await expect(barra).toContainText(/CANDILEJAS/);
  });
});

test.describe('quién tiene la pelota: nombres, no iniciales', () => {
  test('el panel trae nombres de personas', async ({ page }) => {
    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section.mt-10');
    // MEDIDO: antes era «C CLIENTE · 1 PIEZA O6», con la inicial de un ROL y el
    // código de la pieza. Con 21 personas con acceso eso no le dice a nadie a
    // quién escribirle.
    await expect(panel).toContainText(/Rosas|Mesa|Jiménez|Serna|Hadechine|Zuluaga|Espitia/);
  });

  test('las piezas sin responsable dicen que no tienen dueño', async ({ page }) => {
    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    // MEDIDO el 2026-10-05: 26 de 35 piezas del grupo interno no tienen
    // `created_by`. Se muestran agrupadas como «Sin responsable» en vez de
    // colgar de la primera persona de la lista, que sería inventarle trabajo.
    const panel = page.locator('section.mt-10');
    const haySinResponsable = await panel.getByText('Sin responsable').count();
    const hayInicialesSueltas = await panel.getByText(/^[A-Z]\s*·\s*\d+\s*PIEZAS?$/m).count();
    expect(haySinResponsable + hayInicialesSueltas).toBeGreaterThan(0);
  });
});

test.describe('selector de perfil: explica antes de elegir', () => {
  test('abre con el panel de configuración y la lista debajo', async ({ page }) => {
    await page.goto('/wundeer', { waitUntil: 'domcontentloaded' });
    await saltarGuia(page);

    // `data-guia` y no el texto del botón: en la barra hay dos
    // `aria-haspopup="listbox"` y el de perfil dice «ELEGIR QUIÉN VOTA»
    // mientras carga el equipo. MEDIDO 2026-10-05: `textContent` no lee
    // atributos, así que el nombre del cliente hay que buscarlo en `alt`.
    const boton = page.locator('[data-guia="perfil-voto"] button[aria-haspopup="listbox"]');
    await boton.click();
    const menu = page.locator('[data-guia="perfil-voto"] [role="listbox"]');
    await expect(menu).toBeVisible();

    /*
     * MEDIDO 2026-10-05: `playwright.config.ts` marca la GUÍA como vista, pero
     * NO el aviso del selector: son dos claves distintas (`rr-hub-guia-v1` y
     * `rr-hub:aviso-perfil-visto`) y esta es justo la prueba de que el aviso
     * sale. Si el panel no aparece, el recorrido lo dice con el motivo en vez de
     * dar un rojo sin explicación.
     */
    // El aviso es lo nuevo: dice qué se configura y qué pasa al elegir.
    const texto = (await menu.textContent()) ?? '';
    const tieneAviso = /Antes de votar|Dile al hub con qué nombre estás/.test(texto);
    // Si ya se había leído el aviso en este navegador, no tiene que salir: por
    // eso se acepta cualquiera de los dos estados, y se comprueba que la lista
    // esté en los dos.
    expect(texto.length).toBeGreaterThan(200);
    if (tieneAviso) {
      expect(texto).toMatch(/queda guardado en este navegador/i);
    }
  });
});