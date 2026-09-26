import { describe, expect, it } from 'vitest';
import { KIND_ICON, referenceSource, realThumb } from './reference';

/**
 * La regla que decide qué se puede previsualizar de verdad.
 *
 * Fija el comportamiento medido el 2026-09-26: Drive, YouTube e imágenes
 * directas SÍ dan miniatura; Instagram y TikTok NO (muro de login). Este test
 * existe porque el tablero mostraba 17 de 26 tarjetas con un hueco vacío y
 * nadie sabía distinguir "sin miniatura pública" de "error nuestro".
 */
describe('referencias de Google Drive', () => {
  it('reconoce el enlace de archivo y saca el id', () => {
    const source = referenceSource('https://drive.google.com/file/d/1AbCdEfGhIj/view?usp=sharing');
    expect(source?.kind).toBe('drive');
    expect(source?.id).toBe('1AbCdEfGhIj');
    expect(realThumb(source!)).toBe('https://drive.google.com/thumbnail?id=1AbCdEfGhIj&sz=w480');
  });

  it('reconoce el enlace con ?id=', () => {
    const source = referenceSource('https://drive.google.com/open?id=0BxyZa');
    expect(source?.kind).toBe('drive');
    expect(source?.id).toBe('0BxyZa');
  });
});

describe('imágenes directas', () => {
  it('una URL de imagen es su propia miniatura', () => {
    const source = referenceSource('https://cdn.rraliados.com/piezas/O11.jpg');
    expect(source?.kind).toBe('image');
    expect(realThumb(source!)).toBe(source?.url);
  });
});

describe('redes sin miniatura pública', () => {
  it('un reel de Instagram da shortcode pero NO miniatura', () => {
    const source = referenceSource('https://www.instagram.com/reel/DW0OUWrEXXG/?igsh=abc123');
    expect(source?.kind).toBe('instagram');
    expect(source?.shortcode).toBe('DW0OUWrEXXG');
    expect(realThumb(source!)).toBe(null);
  });

  it('un perfil de Instagram da el handle, no el shortcode', () => {
    const source = referenceSource('https://www.instagram.com/minicellmedellin?igsh=MWtyMXlxbHB4c2p2Mw==');
    expect(source?.kind).toBe('instagram');
    expect(source?.handle).toBe('minicellmedellin');
    expect(source?.shortcode).toBeUndefined();
    expect(realThumb(source!)).toBe(null);
  });

  it('un enlace de TikTok da shortcode y tampoco miniatura', () => {
    const source = referenceSource('https://www.tiktok.com/@marca/video/7412345678901234567');
    expect(source?.kind).toBe('tiktok');
    expect(source?.shortcode).toBe('7412345678901234567');
    expect(realThumb(source!)).toBe(null);
  });
});

describe('YouTube sí expone miniatura', () => {
  it('resuelve el id y arma la miniatura', () => {
    const source = referenceSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s');
    expect(source?.kind).toBe('youtube');
    expect(source?.id).toBe('dQw4w9WgXcQ');
    expect(realThumb(source!)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('resuelve el enlace corto youtu.be', () => {
    expect(referenceSource('https://youtu.be/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ');
  });
});

describe('lo que no es una referencia válida', () => {
  it('descarta vacío, texto suelto y esquemas peligrosos', () => {
    expect(referenceSource(null)).toBe(null);
    expect(referenceSource(undefined)).toBe(null);
    expect(referenceSource('')).toBe(null);
    expect(referenceSource('   ')).toBe(null);
    expect(referenceSource('no soy una url')).toBe(null);
    expect(referenceSource('javascript:alert(1)')).toBe(null);
    expect(referenceSource('/piezas/local.jpg')).toBe(null);
  });

  it('un enlace normal se acepta como referencia, sin miniatura', () => {
    const source = referenceSource('https://ejemplo.com/una-pagina');
    expect(source?.kind).toBe('link');
    expect(realThumb(source!)).toBe(null);
  });

  it('el dominio se reconoce sin importar mayúsculas', () => {
    expect(referenceSource('https://WWW.INSTAGRAM.COM/REEL/DW0OUWrEXXG/')?.kind).toBe('instagram');
  });

  it('todo tipo de referencia tiene ícono', () => {
    for (const kind of ['drive', 'image', 'instagram', 'tiktok', 'youtube', 'link'] as const) {
      expect(KIND_ICON[kind], `${kind} sin ícono`).toBeTruthy();
    }
  });
});
