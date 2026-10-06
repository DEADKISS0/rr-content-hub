/*
 * Descripciones de proyecto: la ficha larga se PARTE en dos cosas.
 *
 * MEDIDO 2026-10-05 (feedback de diseño sobre / y /wundeer): la descripción
 * cruda se pintaba tal cual en la portada del banco y en la del proyecto.
 * Wundeer traía 4.108 caracteres: «LECCION DE ESTE ENCARGO», «QUE CAMBIA EL
 * ENCARGO», «DESCARTADAS Y RESPALDADAS (8)», «A REVISAR POR SANTIAGO (27)».
 * Medía 292×2080 px en la portada del banco y 672×1600 px dentro del proyecto.
 * No es que sobrara: estaba en el sitio equivocado, mezclando lo que el equipo
 * necesita para trabajar con el historial de por qué se descartó cada cosa.
 *
 * LA REGLA: la tarjeta muestra el RESUMEN, que es corto. El resto vive en la
 * ficha completa, que ya se puede abrir. El resumen se genera del texto largo
 * cortando por secciones `===` y quedándose con las que aportan para deciding
 * hoy, no con el registro de lo que se descartó.
 *
 * `resumenProyecto()` es pura: si le pasas el mismo texto, devuelve lo mismo.
 */

const PREFIJO = '===';

/** Cuántas secciones se dejan en el resumen corto. */
const MAX_SECCIONES = 3;

/**
 * Palabras beginnings de sección que NUNCA van al resumen: son historial,
 * no instrucciones de trabajo.
 */
const HISTORIAL = [
  'leccion',
  'que cambia',
  'descartadas',
  'descartadas y respaldadas',
  'a revisar',
  'descartes',
  'alerta de dominio',
  'sin confirmar',
];

/**
 * MEDIDO 2026-10-05: con `MAX_SECCIONES = 3` y el orden en que estaban las
 * secciones, «ESTADO REAL» y «POSICIONAMIENTO» se caían fuera aunque son
 * justamente lo que hay que saber para trabajar. El corte por cantidad sacaba
 * lo importante; ahora el corte es por RANKING y 3 es solo un tope de
 * seguridad para una descripción con muchas secciones válidas.
 */
const PREFERRED = [
  'estado real',
  'posicionamiento',
  'marca lista',
  'datos de producto',
  'que es',
  'descripcion',
];

/** Divide el texto largo en secciones por su encabezado `===`. */
function secciones(descripcion: string): { titulo: string; cuerpo: string }[] {
  const partes = descripcion.split(/={3,}/).map((p) => p.trim()).filter(Boolean);
  if (partes.length <= 1) {
    return partes.length ? [{ titulo: '', cuerpo: partes[0] }] : [];
  }
  // La primera parte es el texto que precede al primer `===`: es el título
  // informal del proyecto ("Contenido organico y pauta para Wundeer.").
  return partes.map((parte, i) => {
    if (i === 0) return { titulo: '', cuerpo: parte };
    /*
     * MEDIDO 2026-10-05: el título se cortaba en el primer salto de línea, y
     * en las fichas reales los encabezados son de una línea que ENDS IN COLON:
     * «ESTADO REAL: MARCA NUEVA, EN LANZAMIENTO.». Con `\n` no había corte y el
     * título se llevaba el cuerpo entero, así que ninguna sección pasaba el
     * filtro y el resumen quedaba solo con la introducción.
     *
     * Ahora se corta en `\n` o en el primer `: `, lo que aparezca primero. El
     * `:` solo cuenta si viene seguido de espacio, para no partir «Costo:» de
     * una frase que lo usa como parte de lapalabra.
     */
    const corteLinea = parte.indexOf('\n');
    const corteColon = parte.indexOf(': ');
    const cortes = [corteLinea, corteColon].filter((c) => c !== -1);
    const corte = cortes.length ? Math.min(...cortes) : -1;
    const titulo = (corte === -1 ? parte : parte.slice(0, corte)).trim();
    const cuerpo = (corte === -1 ? '' : parte.slice(corte + 1)).trim();
    return { titulo, cuerpo };
  });
}

function esHistorial(titulo: string): boolean {
  const t = titulo.toLowerCase();
  return HISTORIAL.some((p) => t.includes(p));
}

/**
 * Resumen corto para tarjetas y cabeceras.
 *
 * Nunca devuelve una cadena vacía: si no puede resumir, devuelve los primeros
 * caracteres. Una tarjeta sin descripción es mejor que una tarjeta con medio
 * briefing pegado.
 */
export function resumenProyecto(descripcion?: string | null): string {
  if (!descripcion) return '';
  const limpio = descripcion.trim();
  if (!limpio) return '';

  const partes = secciones(limpio);
  if (partes.length <= 1) {
    // Sin secciones `===`: el texto ya es corto, se devuelve tal cual.
    return limpio;
  }

  const introductory = partes[0].cuerpo;
  const candidatas = partes.slice(1).filter((s) => s.cuerpo && !esHistorial(s.titulo));

  // Ranking: primero las secciones que el listado marca como las que hay que
  // saber, y después el resto en el orden en que venían. El corte por cantidad
  // era lo que dejaba fuera «ESTADO REAL» y «POSICIONAMIENTO».
  const rango = (titulo: string): number => {
    const t = titulo.toLowerCase();
    const i = PREFERRED.findIndex((p) => t.includes(p));
    return i === -1 ? PREFERRED.length : i;
  };
  const ordenadas = [...candidatas].sort((a, b) => rango(a.titulo) - rango(b.titulo));
  const relevantes = ordenadas.slice(0, MAX_SECCIONES);

  const texto = [introductory, ...relevantes.map((s) => `${s.titulo}: ${s.cuerpo}`)]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

  return texto || limpio.slice(0, 220);
}

/**
 * Cuántas secciones tiene la ficha, para el enlace «ver la ficha completa».
 * Con 1 significa que no hay nada más que ver.
 */
export function seccionesProyecto(descripcion?: string | null): number {
  if (!descripcion) return 0;
  return Math.max(1, secciones(descripcion.trim()).length);
}