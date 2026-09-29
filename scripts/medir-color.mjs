import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 300, height: 420 } });
for (const n of ['A-limpio','B-con-referrer','C-con-xfo']) {
  const b = fs.readFileSync('/tmp/iso-' + n + '.png').toString('base64');
  await pg.setContent('<canvas id="k"></canvas>');
  const res = await pg.evaluate((b64) => new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('k');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let color = 0, gris = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], bl = d[i+2];
        if (Math.max(r,g,bl) - Math.min(r,g,bl) > 18) color++; else gris++;
      }
      const t = color + gris;
      done({ color: (100*color/t).toFixed(1), gris: (100*gris/t).toFixed(1), w: img.width, h: img.height });
    };
    img.src = 'data:image/png;base64,' + b64;
  }), b);
  console.log(n.padEnd(18), res.w + 'x' + res.h, ' color:', res.color + '%', ' gris:', res.gris + '%');
}
await nav.close();