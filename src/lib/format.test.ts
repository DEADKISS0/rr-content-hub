import { describe, expect, it } from 'vitest';

import { formatOf } from '@/components/ui/cover';

/**
 * El formato y la categoría son dos ejes distintos.
 *
 * El 2026-09-30, al agrupar las quince ideas de Wundeer por lo que resuelven
 * ("Ajuste y talla", "Confianza y oficio"), `formatOf` se quedó sin etiqueta en
 * todas: buscaba 'reel'/'foto'/'carrusel' dentro de la categoría y ninguna la
 * tenía. Estas fijan que la categoría manda solo cuando nombra un formato.
 */
describe('formatOf: el formato no se deduce de la categoria', () => {
  it('una categoria tematica NO decide el formato: manda el content_type', () => {
    // Estas son las categorias nuevas, tal cual quedaron en la base.
    expect(formatOf('Ajuste y talla', 'organic').label).toBe('FOTO');
    expect(formatOf('Confianza y oficio', 'organic').label).toBe('FOTO');
    expect(formatOf('Coleccion y styling', 'organic').label).toBe('FOTO');
    expect(formatOf('Segunda vida y comunidad', 'organic').label).toBe('FOTO');
  });

  it('pauta se reconoce por el tipo aunque la categoria no lo diga', () => {
    expect(formatOf('Ajuste y talla', 'paid').label).toBe('PAUTA');
    expect(formatOf('Pauta: catalogo y color', 'paid').label).toBe('PAUTA');
  });

  it('una categoria que SI nombra un formato sigue mandando sobre organic', () => {
    // Las categorias viejas si lo nombraban; ese comportamiento no se pierde.
    expect(formatOf('Lookbook · Urbano', 'organic').label).toBe('FOTO');
    expect(formatOf('Producto · Colorway reel', 'organic').label).toBe('REEL');
    expect(formatOf('Carrusel de tallest', 'organic').label).toBe('CARRUSEL');
  });

  it('una idea de pauta nunca se muestra como REEL aunque su categoria lo pida', () => {
    // El canal manda sobre la palabra: una idea de pauta con "reel" en la
    // categoria es una pauta, y si no se distinguen se pierde en el tablero.
    expect(formatOf('Reel de Fitting', 'paid').label).toBe('PAUTA');
  });

  it('sin datos devuelve FOTO y no revienta', () => {
    expect(formatOf(null, null).label).toBe('FOTO');
    expect(formatOf(undefined, undefined).label).toBe('FOTO');
    expect(formatOf('', '').label).toBe('FOTO');
  });

  it('nunca devuelve una etiqueta vacia', () => {
    // El sintoma en produccion: 15 tarjetas sin texto de formato. Este test es
    // el que lo habria cazado antes de subir nada.
    const categorias = [
      'Ajuste y talla', 'Confianza y oficio', 'Coleccion y styling',
      'Segunda vida y comunidad', 'Pauta: catalogo y color',
    ];
    for (const categoria of categorias) {
      for (const tipo of ['organic', 'paid']) {
        const { label } = formatOf(categoria, tipo);
        expect(label, `${categoria}/${tipo}`).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });
});
