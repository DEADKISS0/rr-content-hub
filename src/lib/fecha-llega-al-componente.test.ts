import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — auditoría, segunda tanda.
 *
 * HALLAZGO encadenado, y es el que hace inútil un arreglo que parece completo.
 *
 * La fecha de salida `due_at` se podía escribir (commit 8884832) y se programó
 * para 14 ideas reales. Al ir a mirarlas en producción no aparecían en ninguna
 * pantalla. Encadenado, con DOS motivos:
 *
 *   1. `getIdeas()` pedía las columnas una por una y `due_at` no estaba en la
 *      lista. El tablero no la recibía.
 *   2. `getIdea()` sí usa `select('*')`, o sea que la fila SÍ llegaba con la
 *      fecha... pero `mapIdea()` RECONSTRUYE el objeto campo por campo, y
 *      `due_at` no estaba entre los campos que copia. Se perdía ahí.
 *
 * El segundo es el que nadie detectó con una prueba: mi primer test miraba el
 * `select('*')` de `getIdea` y daba verde, porque la columna sí venía. La fecha
 * desaparecía tres líneas más abajo, en el `.map()`.
 *
 * Consecuencia para cómo se prueban estas cosas: mirar la consulta NO es
 * mirar el dato. Hay que mirar el mapeo, que es donde la fila se convierte en
 * lo que el componente ve.
 *
 * MEDIDO contra producción: la ficha de P1, con `due_at = 2026-10-02` en la
 * base, devolvía cero apariciones de la fecha en el HTML.
 */

const data = readFileSync(new URL('../lib/data.ts', import.meta.url), 'utf8');

describe('la fila se convierte en lo que el componente ve', () => {
  it('mapIdea copia la fecha de salida', () => {
    // Esta es la línea que faltaba. Sin ella, `select('*')` no sirve de nada.
    expect(data).toMatch(/due_at:\s*\(row\.due_at/);
  });

  it('mapIdea no convierte la fecha en cadena vacía', () => {
    // `undefined` y `null` se pintan distinto que `''`: con `''`, `fechaEs('')`
    // devuelve null, y con `null` también, pero el código queda mintiendo sobre
    // lo que hay. `?? null` es lo honesto: no hay fecha, y se dice.
    expect(data).toMatch(/due_at:[^,]*\?\?\s*null/);
  });

  it('la consulta del tablero pide la columna', () => {
    // El motivo 1. `getIdeas` no usa `*`: nombra columna por columna, así que
    // una columna nueva no llega hasta que alguien la nombre.
    expect(data).toMatch(/created_at,\s*due_at/);
  });

  it('la ficha también trae el enlace de publicación', () => {
    // La otra mitad de lo mismo: `published_url` se escribía y tampoco se
    // veía. Las dos viajan juntas.
    expect(data).toMatch(/published_url:\s*\(row\.published_url/);
  });
});

describe('el texto de la pantalla no basta para dar esto por hecho', () => {
  it('ningún aserto mira solo el select', () => {
    // La lección del turno, escrita para que no se repita. Una prueba que
    // comprueba que la columna SE PIDE prueba la consulta, no el dato.
    // Alguien tiene que mirar el `.map()`.
    expect(data).toMatch(/function mapIdea/);
    const cuerpoMap = data.slice(data.indexOf('function mapIdea'));
    expect(cuerpoMap.slice(0, 1400)).toMatch(/due_at/);
  });
});