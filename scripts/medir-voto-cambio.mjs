import { chromium } from 'playwright';

const URL = 'https://rr-content-hub.vercel.app';

const r = await fetch(`${URL}/api/entrar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ codigo: '1111', correo: 'santiago1209andres@gmail.com', nombre: 'Santiago' }),
});
const bruto = r.headers.getSetCookie().find((c) => c.startsWith('hub_sesion='));
const cookie = {
  name: 'hub_sesion', value: bruto.split(';')[0].split('=')[1],
  domain: 'rr-content-hub.vercel.app', path: '/', expires: 4102444800,
  httpOnly: true, secure: true, sameSite: 'Lax',
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 }, storageState: { cookies: [cookie], origins: [] } });
const pg = await ctx.newPage();
import fs from 'node:fs';
const IDEA = fs.readFileSync('/tmp/idea_sonda.txt', 'utf8').trim();
await pg.goto(URL + '/wundeer/ideas/' + IDEA, { waitUntil: 'networkidle' });

const guia = pg.locator('[role="dialog"][aria-modal="true"]');
if (await guia.count()) {
  await guia.locator('button').last().click().catch(() => pg.keyboard.press('Escape'));
  await pg.waitForTimeout(400);
}

// buscar una idea que este en votacion
const enVotacion = pg.locator('[data-guia="votacion"]').first();
const hay = await enVotacion.count();
console.log('bloques de votacion visibles:', hay);
if (hay) {
  await enVotacion.scrollIntoViewIfNeeded();
  const botones = await enVotacion.locator('button').allInnerTexts();
  console.log('botones:', JSON.stringify(botones));

  const cambio = enVotacion.getByRole('button', { name: /quiero que cambien algo/i });
  console.log('boton de cambio existe:', (await cambio.count()) > 0);
  await cambio.click();
  await pg.waitForTimeout(500);
  const area = pg.locator('#nota-votacion');
  console.log('campo de texto aparece:', (await area.count()) > 0);
  const enviar = enVotacion.getByRole('button', { name: /pedir el cambio/i });
  console.log('enviar deshabilitado sin texto:', await enviar.isDisabled());
  await area.fill('El gancho está bien pero el formato no cabe en 15 segundos.');
  await pg.waitForTimeout(200);
  console.log('enviar habilitado con texto:', !(await enviar.isDisabled()));
  await pg.screenshot({ path: '/tmp/voto-cambio.png', fullPage: true });
  console.log('(no se envia: esto es una medicion, no una prueba de escritura)');
} else {
  console.log('no hay ninguna idea en votacion ahora mismo');
  const filtros = await pg.locator('button').allInnerTexts();
  console.log('botones del tablero:', JSON.stringify(filtros.slice(0, 14)));
}
await nav.close();
