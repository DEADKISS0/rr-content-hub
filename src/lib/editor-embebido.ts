/**
 * Matemática del editor que vive dentro de la ficha.
 *
 * No abre Photopea, Canva, CapCut ni ningún otro sitio. Esos editores, cuando
 * se pueden meter en un iframe, ejecutan el archivo en SU origen; el bucket
 * `rr-content-assets` es de la pieza, y la versión nueva tiene que salir de
 * aquí hacia `/api/subir`. Estas funciones no tocan el DOM: el componente las
 * usa para recortar, rotar y nombrar la versión.
 */

export type FiltroFoto = 'ninguno' | 'gris' | 'sepia' | 'contraste' | 'brillo';
export type Rotacion = 0 | 90 | 180 | 270;
export type ModoEditor = 'foto' | 'video';

export type RecortePct = {
  x: number;
  y: number;
  ancho: number;
  alto: number;
};

const RECORTE_MINIMO = 8;
export const LADO_MAXIMO = 1920;

export const RECORTE_COMPLETO: RecortePct = { x: 0, y: 0, ancho: 100, alto: 100 };

function acotar(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min;
  return Math.min(max, Math.max(min, valor));
}

export function normalizarRecorte(recorte: RecortePct): RecortePct {
  const ancho = acotar(recorte.ancho, RECORTE_MINIMO, 100);
  const alto = acotar(recorte.alto, RECORTE_MINIMO, 100);
  const x = acotar(recorte.x, 0, 100 - ancho);
  const y = acotar(recorte.y, 0, 100 - alto);
  return { x, y, ancho, alto };
}

/** Rectángulo de píxeles dentro de la imagen original, antes de rotar. */
export function rectFuente(ancho: number, alto: number, recorte: RecortePct): { sx: number; sy: number; sw: number; sh: number } {
  const seguro = normalizarRecorte(recorte);
  const natW = Math.max(1, Math.round(ancho));
  const natH = Math.max(1, Math.round(alto));
  const sx = Math.min(natW - 1, Math.round((seguro.x / 100) * natW));
  const sy = Math.min(natH - 1, Math.round((seguro.y / 100) * natH));
  const sw = Math.max(1, Math.min(natW - sx, Math.round((seguro.ancho / 100) * natW)));
  const sh = Math.max(1, Math.min(natH - sy, Math.round((seguro.alto / 100) * natH)));
  return { sx, sy, sw, sh };
}

/** Tamaño del lienzo exportado. 90° y 270° intercambian los lados y nada pasa de 1920 px. */
export function tamanoLienzo(sw: number, sh: number, rotacion: Rotacion, maxLado = LADO_MAXIMO): { w: number; h: number } {
  const girado = rotacion === 90 || rotacion === 270;
  let w = Math.max(1, Math.round(girado ? sh : sw));
  let h = Math.max(1, Math.round(girado ? sw : sh));
  const lado = Math.max(w, h);
  if (lado > maxLado) {
    const escala = maxLado / lado;
    w = Math.max(1, Math.round(w * escala));
    h = Math.max(1, Math.round(h * escala));
  }
  return { w, h };
}

export function filtroCss(filtro: FiltroFoto): string {
  if (filtro === 'gris') return 'grayscale(1)';
  if (filtro === 'sepia') return 'sepia(0.85)';
  if (filtro === 'contraste') return 'contrast(1.35)';
  if (filtro === 'brillo') return 'brightness(1.25)';
  return 'none';
}

export function siguienteRotacion(rotacion: Rotacion): Rotacion {
  if (rotacion === 0) return 90;
  if (rotacion === 90) return 180;
  if (rotacion === 180) return 270;
  return 0;
}

export function marcaSegundos(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00';
  const total = Math.floor(segundos);
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${minutos}:${String(resto).padStart(2, '0')}`;
}

/**
 * El tramo que se puede reproducir. `fin` siempre queda después de `inicio`,
 * y los dos caben en la duración. Un video de 0 s no inventa un tramo.
 */
export function rangoTrim(duracion: number, inicio: number, fin: number): { inicio: number; fin: number } {
  const tope = Number.isFinite(duracion) && duracion > 0 ? duracion : 0;
  if (tope === 0) return { inicio: 0, fin: 0 };
  let desde = acotar(inicio, 0, tope);
  let hasta = acotar(fin, 0, tope);
  if (hasta < desde) [desde, hasta] = [hasta, desde];
  if (hasta - desde < 0.1) hasta = Math.min(tope, desde + 0.1);
  if (hasta - desde < 0.1) desde = Math.max(0, hasta - 0.1);
  const redondear = (n: number) => Math.round(n * 10) / 10;
  return { inicio: redondear(desde), fin: redondear(hasta) };
}

/** `version_label` cabe en 60 caracteres: es el tope que ya recorta `/api/subir`. */
export function etiquetaDeVersion(numero: number, trim?: { inicio: number; fin: number } | null): string {
  const n = Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : 1;
  const base = `v${n}`;
  if (!trim) return base;
  return `${base} ${marcaSegundos(trim.inicio)}-${marcaSegundos(trim.fin)}`.slice(0, 60);
}

const EXTENSION_IMAGEN = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;
const EXTENSION_VIDEO = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;

export function modoDeArchivo(tipo: string, nombre = ''): ModoEditor | null {
  const mime = tipo.toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'foto';
  if (EXTENSION_VIDEO.test(nombre)) return 'video';
  if (EXTENSION_IMAGEN.test(nombre)) return 'foto';
  return null;
}

export function nombreDeSalida(original: string, modo: ModoEditor): string {
  const sinExtension = original.replace(/\.[^.]+$/, '');
  const limpio = sinExtension.replace(/[^\w.\- ]+/g, '_').trim().slice(0, 40);
  const base = limpio || 'edicion';
  return modo === 'video' ? `${base}-portada.jpg` : `${base}-edicion.jpg`;
}
