import { describe, it, expect } from 'vitest';
import { puertaDesdeFilas, getClientesParaLaPuerta, type FilaProyecto } from './puerta';

/**
 * MEDIDO 2026-10-01 (Santiago): "en la vista del link raíz solo ofrece entrar al
 * perfil de candilejas, y pues está mal".
 *
 * Estas filas están sacadas de `rr_hub_projects` con una consulta real, no
 * inventadas para que el test pase. Wundeer tiene 1111, Candilejas 2222, y
 * Satiro y Boga existen con sus ideas pero con `access_code` en NULL.
 *
 * Estas pruebas EJECUTAN la regla. Los otros tests de este bug (`puerta.test.ts`
 * y `puerta-clientes.test.ts`) miran el texto de los archivos, y se comprobó que
 * no muerden: hacer que la función devuelva una lista fija de dos clientes los
 * deja en verde. Un test que no falla cuando vuelve el bug no es un test.
 */

/** Las cuatro filas reales, en el orden en que las devuelve la consulta. */
const FILAS_REALES: FilaProyecto[] = [
  { slug: 'satiro', name: 'Satiro Sushi', brand_primary_color: '#ded116', access_code: null },
  { slug: 'boga', name: 'BOGA', brand_primary_color: '#973d8f', access_code: null },
  { slug: 'wundeer', name: 'WUNDEER', brand_primary_color: '#be076d', access_code: '1111' },
  { slug: 'candilejas', name: 'CANDILEJAS', brand_primary_color: '#ded116', access_code: '2222' },
];

describe('la puerta ofrece los clientes que se pueden abrir', () => {
  it('con las filas reales, salen WUNDEER y CANDILEJAS', () => {
    const puerta = puertaDesdeFilas(FILAS_REALES);
    expect(puerta.map((c) => c.slug)).toEqual(['wundeer', 'candilejas']);
  });

  it('no ofrece un cliente sin código: ese botón no abriría nada', () => {
    // Satiro y Boga son clientes reales con ideas propias. Ofrecerlos sin
    // código es un botón que lleva a un 404 — el síntoma exacto que reportó
    // Santiago cuando escribió "wunder" en el enlace.
    const puerta = puertaDesdeFilas(FILAS_REALES);
    expect(puerta.map((c) => c.slug)).not.toContain('satiro');
    expect(puerta.map((c) => c.slug)).not.toContain('boga');
  });

  it('un cliente nuevo con código aparece sin tocar código', () => {
    // La razón de leerlo de la base: si mañana entra un cliente con su código,
    // tiene que salir solo.
    const puerta = puertaDesdeFilas([...FILAS_REALES, {
      slug: 'nuevo', name: 'NUEVO', brand_primary_color: '#000000', access_code: '5555',
    }]);
    expect(puerta.map((c) => c.codigo)).toContain('5555');
    expect(puerta).toHaveLength(3);
  });

  it('trae el código, el nombre y el color de cada cliente', () => {
    // El código lo necesita el login para rellenar las casillas, el nombre es
    // lo que se ve en el botón y el color es el de la marca del cliente.
    const puerta = puertaDesdeFilas(FILAS_REALES);
    expect(puerta[0]).toEqual({ slug: 'wundeer', nombre: 'WUNDEER', color: '#be076d', codigo: '1111' });
  });

  it('descarta un código en blanco: abriría una puerta sin cerradura', () => {
    const puerta = puertaDesdeFilas([{ slug: 'x', name: 'X', brand_primary_color: null, access_code: '   ' }]);
    expect(puerta).toEqual([]);
  });

  it('descarta una fila sin slug: sin slug no hay ruta que compartir', () => {
    const puerta = puertaDesdeFilas([{ slug: null, name: 'Sin ruta', brand_primary_color: null, access_code: '1111' }]);
    expect(puerta).toEqual([]);
  });

  it('sin filas, no inventa puertas', () => {
    expect(puertaDesdeFilas([])).toEqual([]);
  });
});

describe('sin base no hay puertas inventadas', () => {
  it('lo que devuelve es siempre un arreglo', () => {
    return getClientesParaLaPuerta().then((r) => {
      expect(Array.isArray(r)).toBe(true);
    });
  });
});