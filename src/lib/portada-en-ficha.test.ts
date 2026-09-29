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
