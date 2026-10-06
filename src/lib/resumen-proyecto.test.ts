import { describe, it, expect } from 'vitest';
import { resumenProyecto, seccionesProyecto } from './resumen-proyecto';

/**
 * MEDIDO 2026-10-05: la descripción de Wundeer se pintaba entera en dos sitios.
 * Medía 292×2080 px en la portada del banco y 672×1600 px en el proyecto. Estas
 * pruebas fijan que el resumen se queda con lo que sirve para trabajar y suelta
 * el historial, sin depender de texto suelto.
 */
const WUNDEER = [
  'Contenido organico y pauta para Wundeer.',
  'ESTADO REAL: MARCA NUEVA, EN LANZAMIENTO.',
  'POSICIONAMIENTO (confirmado por Santiago 2026-10-05): urbano, sin mucho estampado; se le habla a gente joven y tambien a adultos; con un tono de lujo pero sin ser muy caro.',
  'LECCION DE ESTE ENCARGO: 27 de 35 piezas tenian referencia de costura casera y 8 las puso un asistente con hashtags.',
  'QUE CAMBIA EL ENCARGO: como la marca es nueva, el trabajo NO es buscar referencias: es crear las primeras.',
  'DESCARTES: costura casera (Seamwork) y moda viral barata.',
  'DESCARTADAS Y RESPALDADAS (8): O28 MiShKa, P20-P23 YourStyleArchive.',
  'A REVISAR POR SANTIAGO (27): Seamwork costura casera x7, patrones de Brittany Mathis x4.',
].join(' === ');

describe('resumenProyecto', () => {
  it('deja fuera el historial: lecciones, descartes y listas de cuentas', () => {
    const resumen = resumenProyecto(WUNDEER);
    expect(resumen).not.toMatch(/LECCION DE ESTE ENCARGO/);
    expect(resumen).not.toMatch(/QUE CAMBIA EL ENCARGO/);
    expect(resumen).not.toMatch(/DESCARTES/);
    expect(resumen).not.toMatch(/DESCARTADAS Y RESPALDADAS/);
    expect(resumen).not.toMatch(/A REVISAR POR SANTIAGO/);
  });

  it('conserva lo que sirve para trabajar hoy', () => {
    const resumen = resumenProyecto(WUNDEER);
    expect(resumen).toMatch(/MARCA NUEVA/);
    expect(resumen).toMatch(/POSICIONAMIENTO/);
  });

  it('nunca devuelve una cadena vacía ni se pasa de largo', () => {
    const resumen = resumenProyecto(WUNDEER);
    expect(resumen.length).toBeGreaterThan(0);
    // MEDIDO: la versión completa eran 4.108 caracteres pintados en la tarjeta.
    expect(resumen.length).toBeLessThan(700);
  });

  it('devuelve el texto tal cual cuando ya es corto y no tiene secciones', () => {
    expect(resumenProyecto('Cadena de 8+ restaurantes.')).toBe('Cadena de 8+ restaurantes.');
  });

  it('no inventa nada con descripción vacía o nula', () => {
    expect(resumenProyecto(null)).toBe('');
    expect(resumenProyecto('')).toBe('');
    expect(resumenProyecto('   ')).toBe('');
  });

  it('si no puede resumir por secciones, recorta y no devuelve vacío', () => {
    // Solo secciones de historial: el filtro se las come todas.
    const soloHistorial = ['Base.', 'DESCARTES: a.', 'LECCION DE ESTE ENCARGO: b.'].join(' === ');
    const resumen = resumenProyecto(soloHistorial);
    expect(resumen.length).toBeGreaterThan(0);
  });
});

describe('seccionesProyecto', () => {
  it('cuenta las secciones para saber si hay ficha completa que abrir', () => {
    expect(seccionesProyecto('Solo una cosa.')).toBe(1);
    expect(seccionesProyecto(WUNDEER)).toBeGreaterThan(1);
    expect(seccionesProyecto(null)).toBe(0);
  });
});