import { test as base, expect, chromium, type Page } from '@playwright/test';

/**
 * La puerta del hub, en un `storageState`.
 *
 * Por qué esto existe: la puerta ya no es una sesión de Supabase, así que no
 * hay `storageState` que exportar a mano — el login de una persona produce una
 * cookie firmada con un vencimiento y no se puede simply versionar. Lo que se
 * puede, y es lo que hace este archivo, es **entrar por la puerta** con el mismo
 * mecanismo que una persona: `POST /api/entrar` con el código del cliente y el
 * correo, y guardar la cookie que devuelve.
 *
 * Por qué NO se pone por defecto: un `storageState` en el repo es una sesión de
 * producción versionada. Con la puerta por código es menos grave (el código son
 * cuatro dígitos y ya están escritos en la pantalla de login), pero el correo
 * sigue siendo el de una persona real y `rr_hub_access` lo trata como owner en
 * algunos proyectos. Sigue siendo un archivo que no va al repo.
 *
 * Cómo usarlo:
 *
 *   HUB_E2E_CODIGO=1111 HUB_E2E_CORREO=tu@correo.com HUB_E2E_NOMBRE="Tu Nombre" \
 *     npx playwright test
 *
 * Y si prefieres generarlo una vez y reutilizarlo:
 *
 *   node scripts/exportar-estado-e2e.mjs > /tmp/hub-state.json
 *   HUB_E2E_STATE=/tmp/hub-state.json npx playwright test
 */

/** El estado guardado, o `null` si la puerta no está configurada en este entorno. */
const CODIGO = process.env.HUB_E2E_CODIGO;
const CORREO = process.env.HUB_E2E_CORREO;
const NOMBRE = process.env.HUB_E2E_NOMBRE;

export const PUERTA_CONFIGURADA = Boolean(CODIGO && CORREO && NOMBRE);

/** El motivo que se ve en el verde de un salto, para que no parezca cobertura. */
export const SIN_PUERTA =
  'la puerta no está configurada: exporta HUB_E2E_CODIGO, HUB_E2E_CORREO y HUB_E2E_NOMBRE';

/**
 * Entra y devuelve el estado de sesión.
 *
 * Se hace por HTTP y no pulsando en la pantalla a propósito: el formulario de
 * cuatro casillas es bueno para una persona y malo para un script (hay que
 * escribir dígito a dígito, y `browser_type` en un input de un carácter a
 * veces se come el foco). La API es la misma que usa el formulario, así que
 * probarla no deja de probarse nada del lado de la puerta.
 */
type CookieCruda = { name: string; value: string };
type CookieCompleta = CookieCruda & {
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
};

export async function entrar(baseURL: string): Promise<{ cookies: CookieCompleta[] }> {
  if (!PUERTA_CONFIGURADA) throw new Error(SIN_PUERTA);

  const respuesta = await fetch(`${baseURL}/api/entrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: CODIGO, correo: CORREO, nombre: NOMBRE }),
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => '');
    throw new Error(`la puerta respondió ${respuesta.status}: ${cuerpo.slice(0, 160)}`);
  }

  const cabeceras = respuesta.headers.getSetCookie?.() ?? [];
  const cookies: CookieCruda[] = cabeceras
    .map((linea): CookieCruda | null => {
      const [par] = linea.split(';');
      const i = par.indexOf('=');
      return i < 0 ? null : { name: par.slice(0, i).trim(), value: par.slice(i + 1).trim() };
    })
    .filter((c): c is CookieCruda => c !== null);

  const sesion = cookies.find((c) => c.name === 'hub_sesion');
  if (!sesion) throw new Error('la puerta respondió 200 pero no emitió la cookie de sesión');

  const domain = new URL(baseURL).hostname;
  return {
    cookies: cookies.map((c) => ({
      ...c,
      domain,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: baseURL.startsWith('https'),
      sameSite: 'Lax' as const,
    })),
  };
}

/**
 * Un `test` que ya entra solo.
 *
 * `beforeAll` construye el contexto una vez y lo reutiliza: entrar por la puerta
 * es una llamada de red y hay 42 recorridos, y hacer 42 entradas a la API por
 * corrida no es una prueba, es una carga.
 *
 * El nombre del fixture NO empieza por `use` a propósito: el linter de React ve
 * `use(pagina)` dentro de un `async` y se queja de que un hook se llama fuera de
 * un componente. Es `playwright`'s `use`, no el de React, pero el linter no lo
 * distingue y el costo de pelearse con él es peor que el nombre.
 */
export const test = base.extend<{ paginaDeLaPuerta: Page }>({
  paginaDeLaPuerta: async ({ browser, baseURL }, usar) => {
    const estado = await entrar(baseURL ?? 'http://localhost:3100');
    const contexto = await browser.newContext({ storageState: { cookies: estado.cookies, origins: [] } });
    const pagina = await contexto.newPage();
    await usar(pagina);
    await contexto.close();
  },
});

export { expect, chromium };
