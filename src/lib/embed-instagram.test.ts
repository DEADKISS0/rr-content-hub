import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El embed de un reel NO es el embed de un post.
 *
 * Santiago, 2026-09-29: "necesito que les pongas link de referencia, eso es lo
 * mas importante, para que se muestre el iframe". Con las referencias puestas en
 * Candilejas, el iframe aparecía (200, con el `src` correcto a primera vista) y
 * se veía **un rectángulo gris vacío**: la referencia estaba, el iframe estaba,
 * y el contenido no.
 *
 * La causa: un solo patrón para las dos clases de post. Con `/embed/captioned/`
 * para todo, el reel responde un marco vacío; con `/embed` para todo, el post con
 * caption pierde su texto. Y `load` se dispara igual en los dos casos porque un
 * error también es una respuesta — el `<iframe onLoad>` no prueba nada.
 *
 * Estos tests fijan la regla sobre el código real, no sobre una copia.
 */
const fuente = readFileSync(
  join(process.cwd(), 'src/components/reference-with-brief.tsx'),
  'utf8',
);

describe('la URL del embed de Instagram', () => {
  const cuerpo = fuente.slice(
    fuente.indexOf('function instagramEmbed'),
    fuente.indexOf('function youtubeEmbed'),
  );

  it('existe la función y decide entre reel y post', () => {
    expect(cuerpo).toContain('function instagramEmbed');
    expect(cuerpo).toMatch(/esReel/);
  });

  it('un reel NO lleva captioned', () => {
    // `/reel/ABC/embed` es la URL del reel. `/embed/captioned/` es la del post
    // de fotos: con esa, Meta devuelve el marco vacío.
    expect(cuerpo).toMatch(/`\$\{base\}\/embed\$\{esReel \? '' : '\/captioned'\}\/`/);
  });

  it('acepta las dos formas de reel que sirve Instagram', () => {
    // `/reel/ABC` y `/reels/ABC` son la misma pieza. Con `reels?` pegado a la
    // barra, `/reel/ABC` no casaba: la "s" opcional se comía la barra final.
    expect(cuerpo).toMatch(/\(\?:reels\?\|tv\)/);
  });

  it('el shortcode admite guion bajo', () => {
    // `DZ-j74OAiN6` es un shortcode real. Un `[A-Za-z0-9-]+` sin guion bajo
    // cortaría el código por la mitad y pediría un post que no existe.
    expect(cuerpo).toMatch(/\[A-Za-z0-9_-\]\+/);
  });

  it('el permalink del reel va con /reel/, no con /p/', () => {
    // `/p/ABC/embed` responde 200 sin post y sin `onRender`: el fallo mudo.
    expect(cuerpo).toMatch(/instagram\.com\/reel\//);
  });
});

describe('el preview compuesto no dice un cliente que no es', () => {
  const preview = readFileSync(
    join(process.cwd(), 'src/components/ui/instagram-embed.tsx'),
    'utf8',
  );

  it('ningún nombre de cliente está escrito a mano', () => {
    // El respaldo pintaba literalmente "wundeer" en el post compuesto. En
    // Candilejas una referencia que no carga anunciaba WUNDEER, que es peor que
    // no mostrar nada: el equipo se queda mirando el cliente equivocado.
    expect(preview).not.toMatch(/wundeer/i);
  });

  it('la marca llega por prop', () => {
    expect(preview).toMatch(/marca = 'instagram'/);
    expect(preview).toMatch(/\{marca\}/);
  });
});

describe('el embed de un reel se detecta también en el componente', () => {
  const preview = readFileSync(
    join(process.cwd(), 'src/components/ui/instagram-embed.tsx'),
    'utf8',
  );

  it('usa el mismo patrón de reel que la ficha', () => {
    // Dos implementaciones del mismo embed con dos regex distintos es como
    // nació el bug: uno se arregló y el otro no.
    expect(preview).toMatch(/\(\?:reels\?\|tv\)/);
  });
});
