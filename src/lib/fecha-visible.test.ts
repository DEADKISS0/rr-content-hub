import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: "ARRANCA" — arranca con la planificación.
 *
 * Hallazgo: después de arreglar que `due_at` se pudiera escribir (commit
 * 8884832), se programan 14 ideas de Wundeer con fecha real. Y al ir a
 * mirarlas salió esto:
 *
 *   grep -rn 'due_at' src/components/ src/app/  ->  NINGUNO
 *
 * La fecha se guardaba y no se veía en NINGÚN sitio. Eso hace inútil el
 * arreglo anterior: una fecha invisible no es un plan, es un dato huérfano.
 *
 * Sin esto, las 14 fechas que se pusieron se verían como un campo invisible y
 * el equipo no sabría cuál sale primero.
 *
 * Estas pruebas fijan que la fecha se MUESTRE, en los dos lugares donde
 * importa: la ficha de la idea y la cola de salida.
 */

const cola = readFileSync(new URL('../components/queue-section.tsx', import.meta.url), 'utf8');
const ficha = readFileSync(new URL('../app/[projectSlug]/ideas/[ideaId]/page.tsx', import.meta.url), 'utf8');
const data = readFileSync(new URL('../lib/data.ts', import.meta.url), 'utf8');

describe('la fecha de salida es visible, no un dato huérfano', () => {
  it('la ficha de la idea muestra la fecha', () => {
    expect(ficha).toMatch(/due_at/);
  });

  it('la cola de publicaciones muestra la fecha', () => {
    expect(cola).toMatch(/due_at/);
  });

  it('el servidor trae la fecha, y la copia al mapa', () => {
    /*
     * MEDIDO 2026-10-01: esta prueba estaba mal y daba verde mientras la fecha
     * NO llegaba a la pantalla. Dos motivos encadenados:
     *
     * 1. `getIdeas` nombra columna por columna y `due_at` no estaba en la lista.
     * 2. `getIdea` usa `select('*')` y la traía, pero `mapIdea()` reconstruye
     *    el objeto campo por campo y `due_at` no estaba entre los que copia.
     *
     * Yo miraba el `*` y daba por hecho que con eso llegaba. No llega: se
     * pierde en el `.map()`. Esta versión exige las dos cosas, la consulta Y el
     * mapeo, y la otra prueba (fecha-llega-al-componente) las separa para que
     * se vea cuál de las dos se rompió.
     */
    expect(data).toMatch(/created_at,\s*due_at/);
    expect(data).toMatch(/due_at:\s*\(row\.due_at/);
  });
});

describe('la fecha se formatea como fecha, no como fecha ISO', () => {
  it('no se pinta el ISO crudo', () => {
    // `2026-10-02T00:00:00.000Z` en pantalla es ilegible. La regla: el ISO solo
    // puede aparecer dentro del formateador, nunca interpolado en el JSX.
    const pintanFecha = [cola, ficha].join('\n');
    expect(pintanFecha).toMatch(/fechaEs\(/);
    // Y en el JSX, lo que se pinta es el resultado del formateador.
    expect(pintanFecha).not.toMatch(/\{idea\.due_at\}/);
    expect(pintanFecha).not.toMatch(/\{idea\?\.due_at\}/);
  });
});