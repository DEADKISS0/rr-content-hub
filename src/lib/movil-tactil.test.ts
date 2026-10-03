import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lo que se midió en un teléfono y NO se podía pulsar o no cabía.
 *
 * MEDIDO 2026-10-03 con Playwright en 320 / 390 / 768 px, sobre producción. Estos
 * son los tamaños reales que salieron, no Heights inventados:
 *
 *   ELEGIR QUIÉN VOTA        174x29 px   (el control con el que se vota)
 *   TARJETAS / LISTA          108x28 px
 *   ¿QUÉ SIGNIFICA ESTO?     205x30 px
 *   enlaces del pie 53x17 / 105x17 / 143x17 px
 *   filtros de contenido     28 px de alto
 *
 * Y un desborde de verdad: en `/select-project` a 320 px, el nombre del cliente
 * llegaba a right=385 con un viewport de 320. 65 px fuera de la pantalla.
 */
const raiz = join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8');

/** Las clases de los <button> de un archivo. */
const clasesDeBotones = (rel: string) => {
  const c = leer(rel);
  return (c.match(/<button[\s\S]*?<\/button>/g) ?? [])
    .map((b) => b.match(/className=(?:"([^"]*)"|\{`([^`]*)`)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => `${m[1] ?? ''} ${m[2] ?? ''}`);
};

describe('en un dedo se puede pulsar lo que hace falta (44 px)', () => {
  it('el selector de perfil, que es con el que se elige con quién se vota', () => {
    // MEDIDO 174x29. Es el control que decide de quién es el voto: que sea
    // difícil de pulsar es que el voto no salga.
    const clases = clasesDeBotones('src/components/selector-perfil.tsx');
    expect(clases.length).toBeGreaterThanOrEqual(3); // abrir, cada opción, olvidar
    for (const c of clases) {
      expect(c, c.slice(0, 70)).toMatch(/min-h-\[44px\]/);
    }
  });

  it('las opciones del desplegable y el botón de olvidar también', () => {
    const c = leer('src/components/selector-perfil.tsx');
    // MEDIDO: la lista de nombres y el OLVIDAR ESTE PERFIL salían a 28 y 16 px.
    expect(c).toMatch(/flex min-h-\[44px\] w-full items-center/);
    expect(c).toMatch(/flex min-h-\[44px\] w-full items-center justify-center/);
  });

  it('los filtros del tablero: TIPO, RESPONSABLE y ARISTA', () => {
    // MEDIDO 28 px de alto. Un filtro que no se puede pulsar es un filtro que no
    // filtra.
    //
    // Se cuentan los que llevan la clase COMPLETA de filtro, no `min-h-[44px]`
    // a secas: hay cuatro (TODOS de tipo, cada grupo de responsable, TODAS de
    // arista y cada arista) y el aserto antiguo pedía `>= 3` sobre un `replace`
    // que quita uno solo — que con tres presentes daba verde con dos.
    const c = leer('src/components/board-controls.tsx');
    const FILTRO = 'min-h-[44px] items-center border px-2.5 py-1.5 font-mono text-xs uppercase';
    const filtros = c.split(FILTRO).length - 1;
    expect(filtros, 'filtros con 44 px de alto').toBeGreaterThanOrEqual(4);
    // Y ninguno se queda con la clase corta, que es la que mide 28 px.
    expect(c).not.toMatch(/inline-flex items-center border px-2\.5 py-1\.5 font-mono text-xs uppercase/);
  });

  it('TARJETAS / LISTA, el cambio de vista', () => {
    // MEDIDO 108x28 px. Es un único botón que alterna entre las dos vistas, no dos
    // botones: un test que esperara dos estaría midiendo algo que no existe.
    const c = leer('src/components/board-controls.tsx');
    const toggle = c.slice(c.indexOf('anim-pop inline-flex'), c.indexOf('anim-pop inline-flex') + 260);
    expect(toggle, 'no se encontró el botón de cambio de vista').toMatch(/min-h-\[44px\]/);
  });

  it('¿QUÉ SIGNIFICA ESTO?, que explica el flujo', () => {
    // El className va ANTES del texto: buscarlo desde el rótulo y cortar en el
    // primer `>` se pasa el atributo y no encuentra nada.
    const c = leer('src/components/flow-guide.tsx');
    const antes = c.slice(0, c.indexOf('QUÉ SIGNIFICA ESTO'));
    const elemento = antes.slice(antes.lastIndexOf('<button'));
    const clase = elemento.match(/className="([^"]*)"/);
    expect(clase, 'no se encontró el botón de la explicación').toBeTruthy();
    expect(clase![1]).toMatch(/min-h-\[44px\]/);
  });

  it('los enlaces del pie: la única forma de volver o cambiar de cliente', () => {
    // MEDIDO 53x17, 105x17 y 143x17 px. Un enlace de 17 px de alto es un enlace
    // que no se abre con el dedo.
    const c = leer('src/components/hub-footer.tsx');
    const enlaces = (c.match(/className="[^"]*min-h-\[44px\][^"]*"/g) ?? []);
    expect(enlaces.length).toBeGreaterThanOrEqual(3);
  });
});

describe('nada se sale de la pantalla en un teléfono', () => {
  it('el nombre del cliente no empuja la caja fuera del viewport', () => {
    // MEDIDO a 320 px: el <h2> llegaba a right=385. La fila era
    // `flex items-center gap-4` sin envoltorio, y la columna del texto no
    // `min-w-0`, así que no bajaba de su contenido.
    const c = leer('src/app/select-project/page.tsx');
    expect(c).toMatch(/<div className="flex min-w-0 items-center gap-4">/);
    // Y el nombre se parte en varias líneas en vez de empujar.
    expect(c).toMatch(/<div className="min-w-0">/);
    expect(c).toMatch(/break-words font-display text-3xl/);
    // A 5xl, «CANDILEJAS» mide 280 px: no caben en 320 con el cuadrado de color.
    expect(c).not.toMatch(/font-display text-5xl[^"]*>\{cliente\.name\}/);
  });

  it('la etiqueta de 10 px del selector sube a 11 px', () => {
    // MEDIDO: la etiqueta del botón era `text-[10px]`, ilegible en un teléfono.
    const c = leer('src/components/selector-perfil.tsx');
    expect(c).toMatch(/min-h-\[44px\] items-center gap-2 border px-3 font-mono text-\[11px\]/);
    expect(c).not.toMatch(/min-h-\[44px\][^"]*text-\[10px\]/);
  });
});
