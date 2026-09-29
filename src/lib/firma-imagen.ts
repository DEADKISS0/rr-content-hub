/**
 * ¿Los bytes son de verdad una imagen del tipo que se declara?
 *
 * El `Content-Type` y el nombre del archivo los pone el navegador, es decir,
 * quien sube. Los dos son una promesa. La firma —los primeros bytes del
 * archivo— no la puede cambiar nadie.
 *
 * Por qué importa más de lo que parece: el bucket admite solo imágenes. Un
 * `.html` renombrado a `.png`, subido declarando `image/png`, entra en el filtro
 * de tipos sin problema y se sirve después desde la URL del bucket con la marca
 * del cliente. El filtro por tipo no lo ve; este sí.
 *
 * Se mira el tipo DECLARADO además de la firma, a propósito: un PNG subido
 * como JPEG es un error de quien lo eligió, y dejarlo pasar convertiría un
 * nombre equivocado en un archivo que se ve mal en todos los navegadores.
 */
export function firmaDeImagen(b: Uint8Array, declarado: string): boolean {
  const hex = (n: number) => b[n];
  const cuatro = String.fromCharCode(hex(0), hex(1), hex(2), hex(3));
  if (declarado === 'image/png') return cuatro === '\x89PNG';
  if (declarado === 'image/jpeg') return hex(0) === 0xff && hex(1) === 0xd8 && hex(2) === 0xff;
  if (declarado === 'image/gif') return cuatro.startsWith('GIF8');
  if (declarado === 'image/webp') {
    return cuatro === 'RIFF' && String.fromCharCode(hex(8), hex(9), hex(10), hex(11)) === 'WEBP';
  }
  // AVIF, HEIC y HEIF comparten el `ftyp` en el byte 4: es la marca de los
  // contenedores ISO-BMFF, y por eso basta con mirar los cuatro primeros.
  if (declarado === 'image/avif' || declarado === 'image/heic' || declarado === 'image/heif') {
    return cuatro === 'ftyp';
  }
  return false;
}

/**
 * Los tipos que acepta el bucket, y que la lista tiene que ir al día con
 * `storage.buckets.allowed_mime_types`. Storage compara esa columna por
 * igualdad EXACTA, no por prefijo: un `image/` en la lista hace que un
 * `image/png` dé 415. Medido el 2026-09-28.
 */
export const TIPOS_DE_IMAGEN = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/avif', 'image/heic', 'image/heif',
] as const;
