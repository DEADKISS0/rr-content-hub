import { chromium } from 'playwright';
const nav = await chromium.launch();

// 1) EMBED DENTRO DE NUESTRA PAGINA REAL
const ctx = await nav.newContext({ viewport: { width: 420, height: 900 }, locale: 'es-ES' });
const pg = await ctx.newPage();
await pg.goto('https://rr-content-hub.vercel.app/login', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: /Escribir el c[oó]digo de CANDILEJAS/i }).click();
await pg.waitForTimeout(400);
await pg.getByRole('button', { name: /CONTINUAR/ }).click();
await pg.waitForTimeout(2000);
await pg.locator('select').first().selectOption({ index: 0 });
await pg.getByRole('button', { name: /ENTRAR/ }).click();
await pg.waitForTimeout(3000);
await pg.goto('https://rr-content-hub.vercel.app/candilejas/ideas/ca88d116-7ccb-4afc-a61f-1260846c2171', { waitUntil: 'networkidle' });
await pg.waitForTimeout(7000);
await pg.locator('iframe[src*="instagram"]').first().screenshot({ path: '/tmp/embed-nuestro.png' }).catch((e)=>console.log('no se pudo capturar:', e.message.slice(0,60)));
const box = await pg.locator('iframe[src*="instagram"]').first().boundingBox();
console.log('nuestro iframe box:', box);
await ctx.close();

// 2) el MISMO embed en pagina limpia, MISMO tamano
const ctx2 = await nav.newContext({ viewport: { width: 420, height: 900 }, locale: 'es-ES' });
const pg2 = await ctx2.newPage();
await pg2.setContent(`<body style="margin:0"><iframe src="https://www.instagram.com/reel/Dbs5ndARCKW/embed/" style="width:200px;height:340px;border:0"></iframe></body>`);
await pg2.waitForTimeout(7000);
await pg2.locator('iframe').screenshot({ path: '/tmp/embed-limpio.png' });
console.log('limpio: capturado');
await ctx2.close();
await nav.close();