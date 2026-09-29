# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ficha-reordenada.spec.ts >> ficha reordenada >> el encuadre se adapta al formato y no desperdicia ancho
- Location: e2e/ficha-reordenada.spec.ts:48:7

# Error details

```
Error: expect(received).not.toBeNull()

Received: null
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - heading "Acceder al hub" [level=1] [ref=e3]
    - paragraph [ref=e4]: Acceso para el equipo. Tu correo ya está en la lista, no hay que pedirte registro.
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: TU CORREO
        - textbox "TU CORREO" [ref=e8]:
          - /placeholder: tu@email.com
      - generic [ref=e9]:
        - generic [ref=e10]: TU CONTRASEÑA
        - textbox "TU CONTRASEÑA" [ref=e11]
      - button "ENTRAR" [ref=e12]
      - generic [ref=e13]: O CON GOOGLE
      - button "Entrar con Google" [ref=e17]
      - button "¿No recuerdas la contraseña? Recibe un link por correo" [ref=e18]
  - alert [ref=e19]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
  4   | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  5   | 
  6   | /**
  7   |  * El reordenamiento de la ficha: la referencia sube, la acción se pega al estado.
  8   |  *
  9   |  * El riesgo real de este cambio no es que se vea feo: es que la única acción de
  10  |  * la ficha vuelva a caer bajo el pliegue. Ya pasó una vez (y≈736 en un portátil
  11  |  * de 720 px) y lo cazó un recorrido, no una mirada.
  12  |  */
  13  | test.describe('ficha reordenada', () => {
  14  |   test.use({ viewport: { width: 1280, height: 720 } });
  15  | 
  16  |   test('la acción y la referencia se ven sin hacer scroll', async ({ page }) => {
  17  |     await page.addInitScript(visto);
  18  |     await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  19  | 
  20  |     // 1. La acción existe y es alcanzable: eso es lo que no puede romperse.
  21  |     const accion = page.locator('[data-guia="accion"]');
  22  |     await expect(accion).toBeVisible();
  23  |     await expect(accion).toBeInViewport();
  24  | 
  25  |     // 2. La referencia es la segunda cosa, no la última: sube a la cabecera.
  26  |     const ref = page.locator('[data-guia="brief"]');
  27  |     await expect(ref).toHaveCount(1);
  28  |     const orden = await page.evaluate(() => {
  29  |       const y = (s: string) => {
  30  |         const el = document.querySelector(s);
  31  |         return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1;
  32  |       };
  33  |       return { accion: y('[data-guia="accion"]'), ref: y('[data-guia="brief"]') };
  34  |     });
  35  |     // La referencia va DESPUÉS de la acción y del título, pero no al final de
  36  |     // la ficha. Medido: y=1437 en producción (1280x720), y el bloque entero
  37  |     // mide 1038 px, o sea que ocupa de 1437 a 2475 — la mitad de la página.
  38  |     // Antes estaba al fondo, después de la trazabilidad y los comentarios.
  39  |     // El umbral es 1700: da margen al texto largo sin dejar que vuelva al pie.
  40  |     expect(orden.accion).toBeLessThan(orden.ref);
  41  |     expect(orden.ref).toBeLessThan(1700);
  42  | 
  43  |     // 3. Un solo iframe. El bloque se movió de sitio; duplicarlo sería el
  44  |     //    defecto que ya se corrigió una vez.
  45  |     await expect(page.locator('iframe')).toHaveCount(1);
  46  |   });
  47  | 
  48  |   test('el encuadre se adapta al formato y no desperdicia ancho', async ({ page }) => {
  49  |     await page.addInitScript(visto);
  50  |     await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  51  | 
  52  |     const marco = await page.evaluate(() => {
  53  |       const f = document.querySelector('iframe') as HTMLIFrameElement | null;
  54  |       if (!f) return null;
  55  |       const r = f.getBoundingClientRect();
  56  |       return { ancho: Math.round(r.width), alto: Math.round(r.height) };
  57  |     });
> 58  |     expect(marco).not.toBeNull();
      |                       ^ Error: expect(received).not.toBeNull()
  59  |     if (marco) {
  60  |       const ratio = marco.ancho / marco.alto;
  61  |       console.log(`[marco] ${marco.ancho}x${marco.alto} ratio ${ratio.toFixed(2)}`);
  62  |       // Antes era 276x480 = 0.57. Un marco "normal" está entre 0.6 y 2.2.
  63  |       expect(ratio).toBeGreaterThan(0.6);
  64  |       expect(ratio).toBeLessThan(2.2);
  65  |     }
  66  |   });
  67  | });
  68  | 
  69  | test.describe('en el teléfono', () => {
  70  |   test.use({ viewport: { width: 390, height: 844 } });
  71  | 
  72  |   test('la referencia no se come la pantalla', async ({ page }) => {
  73  |     await page.addInitScript(visto);
  74  |     await page.goto(`/wundeer/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  75  | 
  76  |     const marco = await page.evaluate(() => {
  77  |       const f = document.querySelector('iframe') as HTMLIFrameElement | null;
  78  |       if (!f) return null;
  79  |       const r = f.getBoundingClientRect();
  80  |       return {
  81  |         alto: Math.round(r.height),
  82  |         ventana: window.innerHeight,
  83  |         ancho: Math.round(r.width),
  84  |         anchoPantalla: document.documentElement.clientWidth,
  85  |       };
  86  |     });
  87  |     expect(marco).not.toBeNull();
  88  |     if (marco) {
  89  |       console.log(`[movil] iframe ${marco.ancho}x${marco.alto} en pantalla de ${marco.anchoPantalla}`);
  90  |       // Antes ocupaba el 40% de la pantalla. Ahora no debe pasar de un tercio.
  91  |       expect(marco.alto / marco.ventana).toBeLessThan(0.34);
  92  |       // Y no debe desbordar: el marco angosto no se sale de la tarjeta.
  93  |       expect(marco.ancho).toBeLessThanOrEqual(marco.anchoPantalla);
  94  |     }
  95  | 
  96  |     const desborde = await page.evaluate(
  97  |       () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  98  |     );
  99  |     expect(desborde).toBeLessThanOrEqual(0);
  100 |   });
  101 | });
  102 | 
```