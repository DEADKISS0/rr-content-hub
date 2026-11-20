import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  etiquetaDeVersion,
  filtroCss,
  marcaSegundos,
  modoDeArchivo,
  nombreDeSalida,
  normalizarRecorte,
  rangoTrim,
  rectFuente,
  siguienteRotacion,
  tamanoLienzo,
} from './editor-embebido';

describe('editor embebido', () => {
  it('el recorte no se sale de la imagen y deja al menos un 8%', () => {
    expect(normalizarRecorte({ x: 90, y: -4, ancho: 40, alto: 2 })).toEqual({
      x: 60,
      y: 0,
      ancho: 40,
      alto: 8,
    });
    const pixeles = rectFuente(1000, 500, { x: 10, y: 20, ancho: 50, alto: 40 });
    expect(pixeles).toEqual({ sx: 100, sy: 100, sw: 500, sh: 200 });
  });

  it('rotar 90 intercambia los lados y no pasa de 1920', () => {
    expect(tamanoLienzo(100, 4000, 90)).toEqual({ w: 1920, h: 48 });
    expect(tamanoLienzo(800, 600, 0)).toEqual({ w: 800, h: 600 });
    expect(siguienteRotacion(270)).toBe(0);
  });

  it('el tramo de video cabe en la duración y la etiqueta no se pasa de 60', () => {
    expect(rangoTrim(12, 10, 2)).toEqual({ inicio: 2, fin: 10 });
    expect(rangoTrim(0, 1, 2)).toEqual({ inicio: 0, fin: 0 });
    expect(marcaSegundos(65)).toBe('1:05');
    const etiqueta = etiquetaDeVersion(3, { inicio: 3, fin: 12 });
    expect(etiqueta).toBe('v3 0:03-0:12');
    expect(etiquetaDeVersion(2)).toBe('v2');
    expect(etiqueta.length).toBeLessThanOrEqual(60);
  });

  it('distingue foto y video sin depender solo del nombre', () => {
    expect(modoDeArchivo('image/png', 'foto.mp4')).toBe('foto');
    expect(modoDeArchivo('', 'crudo.mov')).toBe('video');
    expect(modoDeArchivo('application/pdf', 'guion.pdf')).toBeNull();
    expect(filtroCss('sepia')).toBe('sepia(0.85)');
    expect(filtroCss('ninguno')).toBe('none');
    expect(nombreDeSalida('look final.png', 'foto')).toBe('look final-edicion.jpg');
    expect(nombreDeSalida('toma.mp4', 'video')).toBe('toma-portada.jpg');
  });

  it('los bytes del editor salen con la firma y sin una política nueva', () => {
    const ruta = readFileSync(join(__dirname, '../app/api/archivo/route.ts'), 'utf8');
    expect(ruta).toContain("get('bytes')");
    expect(ruta).toContain('firmaDeImagen');
    expect(ruta).toContain('catalogoIncluye');
    expect(ruta).not.toMatch(/create policy/i);
  });

  it('la ficha ya no abre el archivo en otra pestaña', () => {
    const ficha = readFileSync(join(__dirname, '../components/collaboration-enhanced.tsx'), 'utf8');
    expect(ficha).not.toContain('window.open');
    expect(ficha).not.toContain('target="_blank"');
    expect(ficha).toContain('EditorEmbebido');
  });
});
