#!/usr/bin/env node
// NX-1030 paso 2 — fixture de sesión para E2E del plan de publicación.
//
// Por qué existe: `playwright.config.ts` aplica `HUB_E2E_STATE` (storageState
// de una persona con acceso) y sin él los tres recorridos con plan abierto se
// saltan. Este script fabrica ese storageState LOCALMENTE, firmando la cookie
// `hub_sesion` con el MISMO `HUB_SECRET` y el mismo formato que
// `src/lib/hub-session.ts` (carga base64url + HMAC-SHA256 base64url).
//
// Uso (el secreto NUNCA se escribe en el repo, sale del entorno de la corrida):
//   node e2e/fixtures/generar-estado.mjs <secret> <email> <slug> <salida> [origin]
//
// El correo determina el rol: con `SUPER_ADMIN_EMAILS` del servidor de prueba
// el correo-e2e-owner da `owner`; cualquier otro correo queda `sin_rol`
// (solo lectura) porque en modo demo no hay tabla `rr_hub_access`.
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [secret, email, slug, salida, origin = 'http://localhost:3210'] = process.argv.slice(2);
if (!secret || !email || !slug || !salida) {
  console.error('Uso: node e2e/fixtures/generar-estado.mjs <secret> <email> <slug> <salida> [origin]');
  process.exit(1);
}
if (secret.length < 32) {
  console.error('HUB_SECRET demasiado corto (mínimo 32, como exige hub-session.ts).');
  process.exit(1);
}

const carga = Buffer.from(
  JSON.stringify({
    nombre: `E2E ${email}`,
    email,
    proyecto: slug,
    desde: new Date().toISOString(),
  }),
).toString('base64url');
const firma = createHmac('sha256', secret).update(carga).digest('base64url');

const estado = {
  cookies: [
    {
      name: 'hub_sesion',
      value: `${carga}.${firma}`,
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ],
  origins: [
    {
      origin,
      // La guía guiada tapa los clics en contexto limpio (playwright.config.ts).
      localStorage: [
        { name: 'rr-hub-guia-v1', value: 'visto' },
        { name: 'rr-hub:aviso-perfil-visto', value: 'visto' },
      ],
    },
  ],
};

writeFileSync(salida, JSON.stringify(estado, null, 2));
console.log(`estado escrito en ${salida} (cookie firmada para ${email})`);
