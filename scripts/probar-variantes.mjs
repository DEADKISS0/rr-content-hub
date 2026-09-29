import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
const casos = [
  ['a-reel-simple',  'https://www.instagram.com/reel/Dbs5ndARCKW/embed/', 'autoplay; encrypted-media; picture-in-picture'],
  ['b-reel-allow',   'https://www.instagram.com/reel/Dbs5ndARCKW/embed/', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share'],
  ['c-con-stkn',     'https://www.instagram.com/reel/Dbs5ndARCKW/?stkn=MWhhYTgxbXp2N3B0cw==/embed/', 'autoplay; encrypted-media'],
  ['d-p-captioned',  'https://www.instagram.com/p/Dbs5ndARCKW/embed/captioned/', 'autoplay; encrypted-media'],
];
for (const [nombre, src, allow] of casos) {
  const ctx = await nav.newContext({ viewport: { width: 320, height: 480 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  await pg.setContent(`<body style="margin:0"><iframe src="${src}" style="width:260px;height:462px;border:0" allow="${allow}"></iframe></body>`);
  await pg.waitForTimeout(8000);
  const f = '/tmp/caso-' + nombre + '.png';
  await pg.locator('iframe').screenshot({ path: f });
  const b64 = fs.readFileSync(f).toString('base64');
  const pct = await pg.evaluate((b) => new Promise((d) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im,0,0); const p = x.getImageData(0,0,c.width,c.height).data;
      let col=0; const t=p.length/4;
      for (let i=0;i<p.length;i+=4) if (Math.max(p[i],p[i+1],p[i+2]) - Math.min(p[i],p[i+1],p[i+2]) > 18) col++;
      d((100*col/t).toFixed(1)); };
    im.src = 'data:image/png;base64,' + b; }), b64);
  console.log(nombre.padEnd(18), 'color:', pct + '%');
  await ctx.close();
}
await nav.close();