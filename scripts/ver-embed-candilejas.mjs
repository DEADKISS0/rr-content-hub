import { chromium } from 'playwright';
import fs from 'node:fs';
const lista = [
  ['O8','DcWO-iHOq9T'],['O9','DadYNVxAsOt'],['O10','DaEU309poAv'],['O11','DYxwByMPZ3n'],
  ['O12','DbI-fbyuftK'],['O13','Dc2_MxUsJj9'],['O14','DX7ne9-vpmR'],
];
const nav = await chromium.launch();
for (const [cod, sc] of lista) {
  const ctx = await nav.newContext({ viewport: { width: 320, height: 480 }, locale: 'es-ES' });
  const pg = await ctx.newPage();
  // reintenta: Instagram a veces tarda y hay que darle dos oportunidades
  let pct = 0;
  for (let intento = 1; intento <= 2; intento++) {
    await pg.setContent('<body style="margin:0"><iframe src="https://www.instagram.com/reel/' + sc + '/embed/" style="width:260px;height:462px;border:0"></iframe></body>');
    await pg.waitForTimeout(11000);
    const f = '/tmp/emb-' + cod + '.png';
    await pg.locator('iframe').screenshot({ path: f });
    const b64 = fs.readFileSync(f).toString('base64');
    pct = parseFloat(await pg.evaluate((b) => new Promise((d) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im,0,0); const p = x.getImageData(0,0,c.width,c.height).data;
        let col=0; const t=p.length/4;
        for (let i=0;i<p.length;i+=4) if (Math.max(p[i],p[i+1],p[i+2]) - Math.min(p[i],p[i+1],p[i+2]) > 18) col++;
        d((100*col/t).toFixed(1)); };
      im.src = 'data:image/png;base64,' + b; }), b64));
    if (pct > 10) break;
  }
  console.log(cod, sc, '-> color:', pct + '%', pct > 10 ? 'OK' : 'ROTO');
  await ctx.close();
}
await nav.close();