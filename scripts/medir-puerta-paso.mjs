import { chromium } from 'playwright';

const URL = 'https://rr-content-hub.vercel.app';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const pg = await ctx.newPage();

const errores = [];
pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)); });
pg.on('pageerror', (e) => errores.push('PAGEERROR ' + String(e).slice(0, 200)));

for (const [nombre, boton] of [['WUNDEER', /Escribir el c[oó]digo de WUNDEER/i], ['CANDILEJAS', /Escribir el c[oó]digo de CANDILEJAS/i]]) {
  console.log('=== ' + nombre + ' ===');
  await pg.goto(URL + '/login', { waitUntil: 'networkidle' });
  await pg.getByRole('button', { name: boton }).click();
  await pg.waitForTimeout(500);
  const casillas = await pg.locator('input[inputmode="numeric"]').evaluateAll((e) => e.map((i) => i.value).join(''));
  console.log('  casillas tras el clic:', JSON.stringify(casillas));
  const paso = await pg.locator('form').count();
  console.log('  formularios en pantalla:', paso);
  const nombres = await pg.locator('select option, [role="option"], button:has-text("Elegir")').count();
  console.log('  opciones de persona visibles:', nombres);
  const cuerpo = await pg.locator('main').innerText().catch(() => '');
  console.log('  texto:', cuerpo.slice(0, 200).replace(/\n+/g, ' | '));
  await pg.screenshot({ path: `/tmp/paso1-${nombre}.png`, fullPage: true });
  // pulsar CONTINUAR
  const seguir = pg.getByRole('button', { name: /CONTINUAR|BUSCANDO/ });
  if (await seguir.count()) {
    await seguir.click();
    await pg.waitForTimeout(2500);
    const despues = await pg.locator('main').innerText().catch(() => '');
    console.log('  tras CONTINUAR:', despues.slice(0, 260).replace(/\n+/g, ' | '));
    const opciones = await pg.locator('select, [role="option"], input[type="radio"]').count();
    console.log('  selector de persona:', opciones);
    await pg.screenshot({ path: `/tmp/paso2-${nombre}.png`, fullPage: true });
    // elegir tu nombre y entrar: ESTE es el paso que falla
    const sel = pg.locator('select').first();
    if (await sel.count()) {
      await sel.selectOption({ index: 0 });
      console.log('  nombre elegido:', (await sel.inputValue()).slice(0, 30));
    }
    const entrar = pg.getByRole('button', { name: /ENTRAR|ENTRANDO/ });
    console.log('  boton entrar:', await entrar.count());
    if (await entrar.count()) {
      await entrar.click();
      await pg.waitForTimeout(3500);
      console.log('  URL final:', pg.url().replace(URL, ''));
      const final = await pg.locator('body').innerText();
      const aviso = await pg.locator('[role="alert"]').allInnerTexts();
      console.log('  aviso de error:', JSON.stringify(aviso));
      console.log('  texto final:', final.slice(0, 200).replace(/\n+/g, ' | '));
      await pg.screenshot({ path: `/tmp/paso3-${nombre}.png`, fullPage: true });
    }
  }
  console.log('  errores JS:', errores.length ? errores.slice(0, 3) : 'ninguno');
  errores.length = 0;
}
await nav.close();
