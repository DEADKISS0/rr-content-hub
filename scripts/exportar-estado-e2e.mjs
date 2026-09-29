#!/usr/bin/env node
/**
 * Exporta el estado de sesión del hub para los recorridos de Playwright.
 *
 *   HUB_E2E_CODIGO=1111 HUB_E2E_CORREO=tu@correo.com HUB_E2E_NOMBRE="Tu Nombre" \
 *     node scripts/exportar-estado-e2e.mjs > /tmp/hub-state.json
 *
 * Después:
 *
 *   HUB_E2E_STATE=/tmp/hub-state.json npx playwright test
 *
 * Por qué un script y no la pantalla: la puerta son cuatro casillas de un
 * dígito y `browser_type` sobre un input de un carácter a veces deja el cursor
 * donde no toca. La API es la misma que pulsa el formulario, así que la prueba
 * sigue cubriendo la puerta.
 *
 * ⚠️ El archivo que sale es una sesión de producción. Va a `/tmp`, nunca al
 * repo: `hub_sesion` es una cookie firmada con un vencimiento, y su equivalente
 * es acceso directo a lo que esa persona puede mover.
 *
 * ⚠️ Este script SOLO obtiene el estado. No lo imprime, no lo registra en un
 * log y no lo deja en el directorio del proyecto. Si alguien lo ejecuta sin
 * redirigir, la cookie se escribe en la terminal.
 */

const BASE = process.env.HUB_BASE_URL ?? 'http://localhost:3100';
const CODIGO = process.env.HUB_E2E_CODIGO;
const CORREO = process.env.HUB_E2E_CORREO;
const NOMBRE = process.env.HUB_E2E_NOMBRE;

if (!CODIGO || !CORREO || !NOMBRE) {
  console.error(
    [
      'Faltan datos para entrar. La puerta no se puede probar a ciegas.',
      '',
      '  HUB_E2E_CODIGO   el código de cuatro dígitos del cliente',
      '  HUB_E2E_CORREO   el correo que figura en la lista blanca',
      '  HUB_E2E_NOMBRE   el nombre que aparece en el roster',
      '',
      `Y si el destino no es local: HUB_BASE_URL=https://rr-content-hub.vercel.app`,
    ].join('\n'),
  );
  process.exit(1);
}

const respuesta = await fetch(`${BASE}/api/entrar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ codigo: CODIGO, correo: CORREO, nombre: NOMBRE }),
});

if (!respuesta.ok) {
  console.error(`La puerta respondió ${respuesta.status}.`);
  console.error((await respuesta.text().catch(() => '')).slice(0, 300));
  console.error('Si dice 401, el código no es el de este cliente. Si dice 403, ese correo no está en la lista blanca.');
  process.exit(1);
}

const cabeceras = respuesta.headers.getSetCookie?.() ?? [];
const cookies = cabeceras
  .map((linea) => {
    const [par] = linea.split(';');
    const i = par.indexOf('=');
    if (i < 0) return null;
    return {
      name: par.slice(0, i).trim(),
      value: par.slice(i + 1).trim(),
      domain: new URL(BASE).hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: BASE.startsWith('https'),
      sameSite: 'Lax',
    };
  })
  .filter(Boolean);

if (!cookies.some((c) => c.name === 'hub_sesion')) {
  console.error('La puerta respondió 200 pero no emitió la cookie de sesión. Revisa que /api/entrar siga siendo la ruta viva.');
  process.exit(1);
}

process.stdout.write(JSON.stringify({ cookies, origins: [] }, null, 2) + '\n');
