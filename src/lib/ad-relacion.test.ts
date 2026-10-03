import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — el tablero se quedó VACÍO en producción.
 *
 * Lo que pasó, medido:
 *
 *   Ideas en la base:  46  (19 en voting, 5 en draft, 1 en revisión)
 *   Tarjetas en la pantalla: 0
 *   Login: 200   Página: 200   `idea-card`: 0
 *
 * Los datos estaban ahí. La página cargaba, el menú estaba, las secciones
 * estaban: no había ni una tarjeta. Un fallo de consulta en PostgREST devuelve
 * un error y la app lo trata como "no hay nada", así que un tablero entero
 * puede desaparecer sin dejar un error en pantalla.
 *
 * La causa fue MÍA, en el mismo commit: añadí `ad:name(ad_id)` al `select` de
 * `getIdeas`, que es la función que alimenta el tablero. La respuesta de
 * Supabase fue textual:
 *
 *   PGRST200: Searched for a foreign key relationship between
 *   'rr_hub_ideas' and 'name' in the schema 'public', but no matches were found.
 *
 * PostgREST no tiene una tabla `name`: interpretó `ad:name(ad_id)` como "la
 * tabla `name` de la tabla `ad`". La FOREIGN KEY que une `rr_hub_ideas.ad_id`
 * con `rr_hub_ad_library.id` no existe en el esquema, así que esa relación no
 * se puede pedir. Con ANY malformed embed, la consulta entera se cae, y con
 * ella las 46 ideas.
 *
 * Por qué no lo atrapó el gate: `npm test` pasa porque los tests leen el
 * código como texto, no ejecutan la consulta; `tsc` pasa porque la cadena es
 * un string válido; `next build` pasa porque la consulta solo se ejecuta en
 * runtime. Ninguno de los tres toca Supabase.
 *
 * Estos tests son la red que faltaba: fallan si vuelve a meterse un embed que
 * no existe.
 */
const data = readFileSync(new URL('./data.ts', import.meta.url), 'utf8');

describe('el select del tablero no se puede romper con una relacion inexistente', () => {
  it('getIdeas no pide embeds anidados sin foreign key', () => {
    // La forma correcta seria `ad:rr_hub_ad_library(...)`, y solo si la FK
    // existe. No existe. MEDIDO en el esquema: no hay relacion entre
    // `rr_hub_ideas` y la biblioteca, solo un `ad_id` suelto.
    expect(data).not.toMatch(/ad:name\(/);
    // Un embed de PostgREST es `alias:tabla(...)`. En este archivo HAY embeds
    // legitimos y funcionan: `projects:rr_hub_projects(...)` y
    // `cover_asset:cover_asset_id(...)` — esas relaciones si existen en el
    // esquema. Un aserto que prohibiera cualquier embed habria sido verde por
    // casualidad, no por medir algo.
    //
    // Lo que se fija es el que rompio: el embed al anuncio. Y se mide solo en el
    // cuerpo de `getIdeas`, que es la funcion que alimenta el tablero: un embed
    // mal escrito en otra pantalla no vacia el tablero.
    const cuerpoGetIdeas = data.slice(
      data.indexOf('export async function getIdeas'),
      data.indexOf('export async function getIdea('),
    );
    // `cover_asset:cover_asset_id(...)` SI es un embed y SI funciona: esa
    // relacion existe. Por eso el aserto no prohibe embeds en general, prohibe
    // el embed del anuncio, que es el que no tiene foreign key.
    expect(cuerpoGetIdeas, 'getIdeas no debe pedir el anuncio como embed')
      .not.toMatch(/\bad:[a-z_]+\s*\(/);
    // Y el embed de portada tiene que seguir ahí: si alguien lo quita para
    // "arreglar" el otro, tambien se rompe la ficha.
    expect(cuerpoGetIdeas).toContain('cover_asset:cover_asset_id(');
    // El nombre de la tabla del anuncio no puede aparecer como embed.
    expect(cuerpoGetIdeas).not.toContain('ad_library');
    expect(cuerpoGetIdeas).not.toContain('ad:');
  });

  it('el tablero pide ad_id, que si existe', () => {
    expect(data).toContain('ad_id');
  });

  it('la miniatura del anuncio se busca por id, no por relacion', () => {
    // Y por eso NO usa un embed: hace su propia consulta con `.eq('id', adId)`,
    // que es una columna y no una relacion. Una columna no se puede escribir
    // mal.
    expect(data).toContain("from('rr_hub_ad_library')");
    expect(data).toContain(".eq('id', adId)");
  });
});

describe('una consulta que falla no puede dejar el tablero en blanco', () => {
  it('getIdeas distingue "no hay ideas" de "no se pudo consultar"', () => {
    // MEDIDO: la pantalla decía 0 tarjetas con 46 ideas en la base. El tablero
    // no distingue entre las dos cosas, y para quien lo mira son idénticas: un
    // tablero vacío.
    //
    // Lo que se fija aquí es que la función NO trague el error en silencio. Si
    // la consulta falla, tiene que quedar rastro. Un error que se come y
    // devuelve una lista vacía es un error que se lee como "no hay nada".
    expect(data).toMatch(/error/);
    expect(data).not.toMatch(/\.catch\(\(\) => \[\]\)/);
  });
});
