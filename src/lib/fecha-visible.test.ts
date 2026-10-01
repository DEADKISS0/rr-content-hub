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

  it('el servidor trae la fecha sin pedirla de más', () => {
    // `getIdeas`/`getIdea` usan `select('*')`, que YA devuelve `due_at`. La
    // primera versión de esta prueba exigía `due_at` en `data.ts` y fallaba sin
    // motivo: el `*` ya lo trae. Lo que sí importa es que no se pida una
    // columna que no existe, que es lo que rompía la portada.
    expect(data).toMatch(/select\('\*'/);
    // Si algún día alguien lista columnas una por una, `due_at` tiene que estar
    // en la lista; por eso queda anotado aquí como contrato.
    expect(data).not.toMatch(/due_at,\s*published_url/);
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