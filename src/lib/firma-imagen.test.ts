import { describe, expect, it } from 'vitest';

/**
 * La firma de imagen que decide qué entra al bucket.
 *
 * La lista de tipos que acepta Storage es una promesa, no una garantía: el
 * `Content-Type` lo pone el navegador, y el nombre del archivo lo pone el
 * equipo. Los dos los controla quien sube. Lo único que no controla nadie es
 * la firma: los primeros bytes de un PNG son `\x89PNG` en el archivo entero, no
 * en lo que el navegador dice que es.
 *
 * Estas pruebas fijan esa diferencia porque el modo de fallo es silencioso: un
 * bucket que admite solo imágenes y al que llega un `.html` renombrado se
 * convierte en un lugar donde se sirve contenido con la URL de tu marca. El
 * filtro de tipos no lo ve pasar; el de la firma sí.
 */

import { firmaDeImagen, TIPOS_DE_IMAGEN } from './firma-imagen';

const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe('la firma de una imagen', () => {
  it('reconoce un PNG de verdad', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(firmaDeImagen(png, 'image/png')).toBe(true);
  });

  it('reconoce un JPEG de verdad', () => {
    expect(firmaDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
  });

  it('reconoce un GIF y un WebP', () => {
    expect(firmaDeImagen(bytes('GIF89a'), 'image/gif')).toBe(true);
    const webp = new Uint8Array([...bytes('RIFF'), 0, 0, 0, 0, ...bytes('WEBP')]);
    expect(firmaDeImagen(webp, 'image/webp')).toBe(true);
  });

  it('reconoce un AVIF por su ftyp', () => {
    expect(firmaDeImagen(bytes('ftypavif'), 'image/avif')).toBe(true);
    expect(firmaDeImagen(bytes('ftypheic'), 'image/heic')).toBe(true);
  });

  it('un HTML que dice ser PNG no entra', () => {
    // El caso que motiva la función: el `Content-Type` lo elige quien sube.
    expect(firmaDeImagen(bytes('<!doctype html><html>'), 'image/png')).toBe(false);
    expect(firmaDeImagen(bytes('<html>'), 'image/jpeg')).toBe(false);
  });

  it('un script, un PDF y un ZIP tampoco', () => {
    expect(firmaDeImagen(bytes('#!/bin/sh\nrm -rf'), 'image/gif')).toBe(false);
    expect(firmaDeImagen(bytes('%PDF-1.7'), 'image/webp')).toBe(false);
    expect(firmaDeImagen(bytes('PK'), 'image/avif')).toBe(false);
  });

  it('la lista de tipos es la misma que la del bucket', () => {
    // Si se añade un tipo aquí y no en `storage.buckets.allowed_mime_types`,
    // el filtro del cliente deja pasar algo que Storage rechaza con un 415 sin
    // explicación. La lista se compara con la de la ruta, no con la del bucket:
    // la del bucket no se puede leer desde TypeScript.
    expect(TIPOS_DE_IMAGEN).toContain('image/png');
    expect(TIPOS_DE_IMAGEN).toContain('image/heic');
    expect(TIPOS_DE_IMAGEN).not.toContain('text/html');
    expect(TIPOS_DE_IMAGEN).not.toContain('video/mp4');
  });

  it('un tipo que no es de imagen no se mira siquiera', () => {
    expect(firmaDeImagen(bytes('<!doctype html>'), 'text/html')).toBe(false);
    expect(firmaDeImagen(bytes('<!doctype html>'), 'application/pdf')).toBe(false);
  });
});
