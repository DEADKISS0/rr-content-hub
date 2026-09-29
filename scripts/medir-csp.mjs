import { chromium } from 'playwright';
import fs from 'node:fs';
const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 300, height: 420 } });
for (const n of ['1-limpio','2-csp-completo','3-solo-frame']) {
  const b = fs.readFileSync('/tmp/csp-' + n + '.png').toString('base64');
  await pg.setContent('<canvas id="k"></canvas>');
  const r = await pg.evaluate((b64) => new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('k'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let color = 0; const t = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.max(d[i], d[i+1], d[i+2]) - Math.min(d[i], d[i+1], d[i+2]) > 18) color++;
      }
      done((100 * color / t).toFixed(1));
    };
    img.src = 'data:image/png;base64,' + b64;
  }), b);
  console.log(n.padEnd(18), 'color:', r + '%');
}
await nav.close();