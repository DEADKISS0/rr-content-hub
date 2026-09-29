import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * La portada TIENE que verse en la ficha de la idea, no solo en el tablero.
 *
 * Santiago, 2026-09-29: "dale mete todas, porfavor con miniatura". Se subieron
 * siete portadas a Candilejas y al abrir las fichas no había ninguna imagen:
 * la única foto de la pagina era el logo. La portada se pintaba en las tarjetas
 * del mapa (`project-map.tsx` y `queue-section.tsx`) y en ningún otro sitio.
 *
 * Este archivo fija que la ficha la pinta. Si alguien la quita, el test falla.
 */
const ficha = readFileSync(
  new URL('../app/[projectSlug]/ideas/[ideaId]/page.tsx', import.meta.url),
  'utf8',
);

describe('la ficha de la idea muestra la portada', () => {
  it('pinta la portada real de la pieza, no un placeholder', () => {
    // Con `cover_asset` presente tiene que existir el marco con la imagen. El
    // componente es el mismo que usan las tarjetas, con `size="lg"` porque
    // arriba del texto la foto se ve a tamaño de pieza, no de miniatura.
    expect(ficha).toMatch(/idea\.cover_asset\s*&&\s*\(/);
    expect(ficha).toMatch(/<IdeaCoverFrame\b/);
    expect(ficha).toMatch(/asset=\{idea\.cover_asset\}/);
  });

  it('la muestra grande y arriba del texto, no al final de la página', () => {
    // El orden importa: si la portada se queda al final, quien abre la idea
    // lee tres párrafos antes de ver de qué va.
    const h1 = ficha.indexOf('<h1');
    const portada = ficha.indexOf('<IdeaCoverFrame');
    const descripcion = ficha.indexOf('{idea.description}');
    expect(h1).toBeGreaterThan(-1);
    expect(portada).toBeGreaterThan(h1);
    expect(portada).toBeLessThan(descripcion);
  });

  it('la ficha importa el componente que usa', () => {
    // Sin este import el build falla, pero el aviso llega tarde y se confunde
    // con otra cosa. Aquí se ve en el test.
    expect(ficha).toMatch(/import \{ IdeaCoverFrame \} from '@\/components\/ui\/idea-cover-frame'/);
  });

  it('una idea SIN portada no deja un hueco roto', () => {
    // El condicional tiene que existir: si no, `IdeaCoverFrame` recibiría
    // undefined y pintaría el placeholder en todas las ideas.
    // (Sin flag `s`: el target del proyecto es es2017 y ese flag no compila.)
    expect(ficha).toMatch(/\{idea\.cover_asset\s*&&\s*\(/);
    expect(ficha).toMatch(/size="lg"/);
  });
});

/**
 * El otro mitad del bug: aunque la ficha pinte `<IdeaCoverFrame asset={...} />`,
 * el valor llegaba `undefined`. `getIdea` hacía `select('*')` y la relación por
 * la columna `cover_asset_id` NO viene en el asterisco — hay que nombrarla.
 *
 *   antes: .select('*')                                    -> cover_asset undefined
 *   ahora: .select('*, cover_asset:cover_asset_id(...)')    -> cover_asset con datos
 *
 * El sintoma era el peor posible: la portada estaba subida, correcta, con
 * `cover_asset_id` poblado, y aun así la ficha pintaba el placeholder. Desde
 * afuera eso se lee como "no le puse la portada", cuando el dato estaba ahí.
 */
const data = readFileSync(new URL('./data.ts', import.meta.url), 'utf8');

describe('getIdea sí trae la portada de la pieza', () => {
  // Cortar por el NOMBRE de la función no vale: `getIdeas`, `getIdeaDetalle` y
  // compañía contienen esa misma cadena, y el tramo se comía código ajeno. Sin
  // este recorte el test daba un falso positivo sobre el `select('*')` de otra
  // consulta y, peor, dejaba de comprobar la que importa.
  const desde = data.indexOf('export async function getIdea(');
  expect(desde).toBeGreaterThan(-1);
  const hasta = data.indexOf('\nexport ', desde + 10);
  const getIdea = data.slice(desde, hasta === -1 ? undefined : hasta);

  it('el tramo es el de getIdea y nada más', () => {
    // Si el recorte se rompe, este test avisa antes de que el otro mienta.
    expect(getIdea).toMatch(/export async function getIdea\(/);
    expect(getIdea).not.toMatch(/export async function getIdeas/);
  });

  it('no usa un select de asterisco solo', () => {
    // La regresión exacta: `select('*')` sin nombrar la relación.
    expect(getIdea).not.toMatch(/\.select\('\*'\)/);
  });

  it('pide la relación por la columna cover_asset_id, con su alias', () => {
    // El alias con dos puntos es lo que hace que PostgREST resuelva la relación
    // y no la tome como una columna suelta. Sin los dos puntos, `PGRST200`.
    expect(getIdea).toMatch(/cover_asset:cover_asset_id\(/);
  });

  it('pide también el external_url, que es lo único que se puede pintar', () => {
    // `storage_path` es una ruta del bucket: la app no la abre sin firmarla en
    // servidor. Pedir solo `storage_path` da un `<img>` que nunca carga.
    expect(getIdea).toMatch(/external_url/);
  });

  it('sigue filtrando por proyecto y por id', () => {
    // El cambio es solo el select: los filtros no se tocan, o una idea de
    // Candilejas se podría abrir con el id de una de Wundeer.
    expect(getIdea).toMatch(/\.eq\('project_id', projectId\)/);
    expect(getIdea).toMatch(/\.eq\('id', id\)/);
  });
});
