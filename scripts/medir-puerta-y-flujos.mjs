import { chromium } from 'playwright';

const URL = 'https://rr-content-hub.vercel.app';
const CODIGO_WUNDEER = '1111';

async function sesion(cookie) {
  return { cookies: cookie ? [cookie] : [], origins: [] };
}

async function entrar(correo) {
  const r = await fetch(`${URL}/api/entrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: CODIGO_WUNDEER, correo, nombre: 'Prueba' }),
  });
  const bruto = r.headers.getSetCookie().find((c) => c.startsWith('hub_sesion='));
  const valor = bruto.split(';')[0].split('=')[1];
  return {
    name: 'hub_sesion', value: valor, domain: 'rr-content-hub.vercel.app',
    path: '/', expires: 4102444800, httpOnly: true, secure: true, sameSite: 'Lax',
  };
}

const nav = await chromium.launch();

// 1) la raiz sin sesion
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(URL + '/', { waitUntil: 'networkidle' });
  console.log('1) RAIZ SIN SESION');
  console.log('   url:', pg.url().replace(URL, '') || '/');
  console.log('   h1:', (await pg.locator('h1').first().innerText().catch(() => '(ninguno)')).replace(/\n/g, ' '));
  await ctx.close();
}

// 2) la puerta con un clic
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 } });
  const pg = await ctx.newPage();
  await pg.goto(URL + '/login', { waitUntil: 'networkidle' });
  console.log('2) PUERTA');
  const antes = await pg.locator('input[inputmode="numeric"]').evaluateAll((e) => e.map((i) => i.value).join(''));
  console.log('   casillas antes del clic:', JSON.stringify(antes));
  await pg.getByRole('button', { name: /Escribir el c[oó]digo de WUNDEER/i }).click();
  await pg.waitForTimeout(400);
  const despues = await pg.locator('input[inputmode="numeric"]').evaluateAll((e) => e.map((i) => i.value).join(''));
  console.log('   casillas tras el clic: ', JSON.stringify(despues));
  console.log('   la pagina cambio de paso:', await pg.locator('text=/Continuar con|qui[eé]n eres/i').count() > 0);
  const textoPantalla = await pg.locator('body').innerText();
  console.log('   el codigo sale escrito en algun sitio:', /\b1111\b/.test(textoPantalla) ? 'SI (mal)' : 'no');
  await pg.screenshot({ path: '/tmp/puerta-clic.png', fullPage: true });
  await ctx.close();
}

// 3) la votacion con sus cuatro respuestas
{
  const cookie = await entrar(process.env.HUB_E2E_CORREO);
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 }, storageState: await sesion(cookie) });
  const pg = await ctx.newPage();
  await pg.goto(URL + '/wundeer', { waitUntil: 'networkidle' });
  const guia = pg.locator('[role="dialog"][aria-modal="true"]');
  if (await guia.count()) {
    const cerrar = guia.locator('button').last();
    await cerrar.click().catch(() => pg.keyboard.press('Escape'));
    await pg.waitForTimeout(400);
  }
  await pg.getByRole('button', { name: /qu[eé] significa esto/i }).click();
  await pg.waitForTimeout(500);
  const reglas = await pg.locator('text=/LAS REGLAS, QUE NO SE DEDUCEN/').count();
  console.log('3) FLUJOS');
  console.log('   la caja de reglas aparece:', reglas > 0);
  const cajas = await pg.locator('text=/LA VOTACI[OÓ]N INTERNA|LAS CUATRO RESPUESTAS|CUANDO EL CLIENTE NO RESPONDE|QUI[EÉ]N PUEDE MOVER QU[EÉ]/').allInnerTexts();
  console.log('   reglas listadas:', cajas.length, cajas.map((c) => c.replace(/\n/g, ' ')).join(' | '));
  await pg.screenshot({ path: '/tmp/flujos.png', fullPage: true });
  await ctx.close();
}

await nav.close();
