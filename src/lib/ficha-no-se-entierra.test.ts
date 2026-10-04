import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/**
 * MEDIDO 2026-10-04 en producción, con el dedo a 390 px.
 *
 * Santiago: «cuando selecciono alguna idea no aparece nada».
 *
 * La ficha SÍ pintaba: título, descripción, la caja de la votación con sus cuatro
 * botones de 274×83. Todo estaba en el DOM. Lo que no pasaba es que se viera.
 *
 * `PanelPresencia` pintaba un renglón por fila de `rr_hub_presencia`, y esa tabla
 * tenía **247 filas de las cuales 236 eran `visitante-…`**, creados por el propio
 * endpoint de latido en cada visita sin sesión. Resultado medido:
 *
 * | bloque            | alto      |
 * |-------------------|-----------|
 * | `data-guia=accion`| 12.268 px |
 * | presencia         | 10.720 px |
 * | la votación       | y = −11.142 |
 *
 * Es decir: la votación estaba **11.000 px por encima** de la pantalla. El usuario
 * tocaba, scrolleaba entre renglones de nombres, y no llegaba nunca. «No aparece
 * nada» era exactamente eso — la página no estaba rota, estaba enterrada.
 *
 * El detalle que hace este bug tan escurridizo: los botones existían y eran
 * grandes. Cualquier prueba que mire «¿existe el botón de votar?» pasa. Solo
 * falla la que mira dónde está.
 */
describe('la ficha no crece sin limite', () => {
  it('el panel de presencia acota los renglones de verdad', () => {
    const panel = leer('src/components/presencia-equipo.tsx');
    const tope = /MAX_RENGLONES\s*=\s*(\d+)/.exec(panel);
    expect(tope, 'falta el tope MAX_RENGLONES').not.toBeNull();

    // ESTA es la asercion que muerde. Comprobar que la constante existe no dice
    // nada: basta cambiar `= 20` por `= 9999` y el test sigue pasando con un panel
    // que crece sin limite. Lo que importa es el NUMERO.
    //
    // 20 es lo medido: con el equipo real (21 perfiles) el bloque entero cabe en
    // una pantalla de movil, y cualquier lista mas larga se pliega. Un tope de
    // 500 seria el mismo bug que no tener tope, solo que mas despacio.
    const n = Number(tope![1]);
    expect(n, `el tope es ${n}: la ficha vuelve a medir miles de pixeles`).toBeLessThanOrEqual(25);
    expect(n, 'un tope de 1 no deja ver a quien esta conectado').toBeGreaterThanOrEqual(10);

    // Y se USA al cortar, no solo al declarar.
    const usos = (panel.match(/MAX_RENGLONES/g) ?? []).length;
    expect(usos, 'MAX_RENGLONES aparece una vez: no acota nada').toBeGreaterThanOrEqual(3);
  });

  it('quien no esta conectado queda plegado, no en la lista de siempre', () => {
    const panel = leer('src/components/presencia-equipo.tsx');
    expect(panel).toMatch(/<details/);
    expect(panel).toMatch(/LOS DEMÁS|los demas/i);
    // El plegado no sirve si la lista completa se pinta igual arriba. Con el
    // tope puesto, `equipo` solo puede aparecer ya recortado por `aMostrar`; si
    // alguien lo vuelve a pintar directo, la lista entera regresa arriba.
    const sinTope = /\.map\(renglon\)|equipo\.map|aMostrar\(equipo/.test(panel)
      && /\{\s*equipo\.map\s*\(/.test(panel);
    expect(sinTope, 'la lista completa se sigue pintando entera: el details no acorta nada').toBe(false);

    // Y lo que se pinta arriba tiene que estar recortado de verdad.
    const arriba = /aMostrar\(enLinea,\s*MAX_RENGLONES\)\.map\(renglon\)/.test(panel);
    expect(arriba, 'el bloque de conectados no pasa por el tope').toBe(true);
  });

  it('el latido NO inventa visitantes: sin sesion se rechaza', () => {
    // La raiz: el POST escribia un identificador distinto en cada latido sin
    // sesion. Con `onConflict: 'email'` eso es una fila nueva por visita —236 en
    // un dia, todas de mis pruebas— y el panel las pintaba una por una.
    const ruta = leer('src/app/api/presencia/route.ts');
    const codigo = ruta
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');

    // (a) no se compone ningun identificador anonimo
    expect(codigo, 'el codigo sigue inventando una identidad anonima').not.toMatch(
      /visitante-|crypto\.randomUUID|Math\.random\(\).toString\(36\)/,
    );

    // (b) sin sesion se RESPONDE 401 y se corta: no se llega al `upsert`.
    const post = codigo.slice(codigo.indexOf('export async function POST'));
    const corte = /if \(!sesion\)[\s\S]{0,300}?status:\s*401[\s\S]{0,200}?return\s+NextResponse/.exec(post);
    expect(corte, 'sin sesion el POST no corta con 401 antes del upsert').not.toBeNull();
  });

  it('el GET de presencia tambien exige sesion', () => {
    // Si el GET acepta y el POST no, la tabla se limpia pero el panel sigue
    // leyendo basura vieja: el fallo vuelve por la puerta de atrás.
    const ruta = leer('src/app/api/presencia/route.ts');
    const get = ruta.slice(ruta.indexOf('export async function GET'));
    expect(get, 'el GET acepta sin sesion: la tabla se limpia pero el panel no').toMatch(
      /if \(!sesion\)/,
    );
  });
});