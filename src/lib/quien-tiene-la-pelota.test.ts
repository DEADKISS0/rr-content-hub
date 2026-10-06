import { describe, it, expect } from 'vitest';
import { nombreCorto, iniciales, agruparPorPersona } from './quien-tiene-la-pelota';

/**
 * MEDIDO 2026-10-05: el panel mostraba «C CLIENTE · 1 PIEZA O6» con una inicial
 * y códigos de pieza. Santiago pidió nombres con primer nombre y primer apellido.
 * Estos casos salen de `rr_hub_profiles.full_name`, medidos el 2026-10-05.
 */
describe('nombreCorto', () => {
  it('deja primer nombre y primer apellido de un nombre con dos apellidos', () => {
    // MEDIDO sobre rr_hub_profiles: el patrón del equipo es nombre + nombre
    // compuesto + dos apellidos. El primer apellido es la TERCERA parte.
    expect(nombreCorto('Andrés Santiago Rosas Rios')).toBe('Andrés Rosas');
    expect(nombreCorto('Juan Manuel Mesa Posada')).toBe('Juan Mesa');
    expect(nombreCorto('Nicolás David Río Vargas')).toBe('Nicolás Río');
    expect(nombreCorto('María Alejandra Peralta Suarez')).toBe('María Peralta');
  });

  it('con tres partes toma la segunda, que es el primer apellido', () => {
    expect(nombreCorto('Samuel Jiménez Ochoa')).toBe('Samuel Jiménez');
    expect(nombreCorto('Santiago Medina Lopez')).toBe('Santiago Medina');
    expect(nombreCorto('Estiven Serna Benítez')).toBe('Estiven Serna');
  });

  it('no toca lo que ya son dos palabras', () => {
    expect(nombreCorto('Sthefany Diaz')).toBe('Sthefany Diaz');
    expect(nombreCorto('Alejandra Suarez')).toBe('Alejandra Suarez');
  });

  it('no mutila las cuentas que no son personas', () => {
    // MEDIDO sobre rr_hub_profiles: estos son los `full_name` reales. Las dos
    // filas de cliente se distinguen SOLO por el número final, así que la cuenta
    // se devuelve entera: recortar el «1» haría que las dos se leyeran igual.
    expect(nombreCorto('RR Aliados')).toBe('RR Aliados');
    expect(nombreCorto('Chat RR')).toBe('Chat RR');
    expect(nombreCorto('Chat RR aliados')).toBe('Chat RR aliados');
    expect(nombreCorto('Cliente Wundeer 1')).toBe('Cliente Wundeer 1');
    expect(nombreCorto('Cliente Wundeer 2')).toBe('Cliente Wundeer 2');
  });

  it('no inventa un nombre cuando no hay ninguno', () => {
    expect(nombreCorto(null)).toBe('');
    expect(nombreCorto(undefined)).toBe('');
    expect(nombreCorto('')).toBe('');
    expect(nombreCorto('   ')).toBe('');
  });
});

describe('iniciales', () => {
  it('toma la primera del nombre y la del apellido corto', () => {
    expect(iniciales('Andrés Santiago Rosas Rios')).toBe('AR');
    expect(iniciales('Samuel Jiménez Ochoa')).toBe('SJ');
    expect(iniciales('Sthefany Diaz')).toBe('SD');
  });

  it('deja un signo de pregunta cuando no hay nombre, no una letra inventada', () => {
    expect(iniciales(null)).toBe('?');
    expect(iniciales('')).toBe('?');
  });
});

describe('agruparPorPersona', () => {
  const piezas = [
    { id: '1', code: 'O6' },
    { id: '2', code: 'O10' },
    { id: '3', code: 'O11' },
    { id: '4', code: 'P4' },
  ];

  it('agrupa por persona y cuenta cuántas piezas tiene cada una', () => {
    const responsables = new Map<string, string | null>([
      ['1', 'Andrés Santiago Rosas Rios'],
      ['2', 'Juan Manuel Mesa Posada'],
      ['3', 'Samuel Jiménez Ochoa'],
      ['4', 'Andrés Santiago Rosas Rios'],
    ]);
    const grupos = agruparPorPersona(piezas, responsables);
    expect(grupos[0]).toEqual({ nombre: 'Andrés Rosas', piezas: ['O6', 'P4'], total: 2 });
    expect(grupos).toHaveLength(3);
  });

  it('deja las piezas sin responsable en su propio grupo y no las cuelga de otro', () => {
    const responsables = new Map<string, string | null>([
      ['1', 'Andrés Santiago Rosas Rios'],
      ['2', null],
      ['3', null],
      ['4', null],
    ]);
    const grupos = agruparPorPersona(piezas, responsables);
    const sueltos = grupos.find((g) => g.nombre === 'Sin responsable');
    expect(sueltos).toBeDefined();
    expect(sueltos?.total).toBe(3);
    // Nadie recibe una pieza que no es suya.
    const andres = grupos.find((g) => g.nombre === 'Andrés Rosas');
    expect(andres?.piezas).toEqual(['O6']);
  });

  it('ordena por cantidad de piezas, de más a menos', () => {
    const responsables = new Map<string, string | null>([
      ['1', 'Sthefany Diaz'],
      ['2', 'Andrés Santiago Rosas Rios'],
      ['3', 'Andrés Santiago Rosas Rios'],
      ['4', 'Andrés Santiago Rosas Rios'],
    ]);
    const grupos = agruparPorPersona(piezas, responsables);
    expect(grupos[0].nombre).toBe('Andrés Rosas');
    expect(grupos[0].total).toBe(3);
  });

  it('no revienta con lista vacía', () => {
    expect(agruparPorPersona([], new Map())).toEqual([]);
  });
});