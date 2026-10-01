/**
 * La fecha de salida, en español y corta.
 *
 * MEDIDO 2026-10-01: se programaron 14 ideas de Wundeer con fecha real y, al ir
 * a mirarlas, `due_at` no aparecía en NINGÚN componente. La fecha se guardaba y
 * no se veía: un dato huérfano. Sin esto, el arreglo de poder registrarla (commit
 * 8884832) no cambian nada en la práctica.
 *
 * Por qué un módulo aparte y no un `toLocaleDateString` en el JSX:
 *
 * - La fecha llega como ISO con zona (`2026-10-02T00:00:00.000Z`). Pintarla
 *   crudo es ilegible, y con `new Date(...)` el UTC puede restar un día: una
 *   fecha puesta para el 2 se ve el 1 según dónde se pinte.
 * - La salida tiene que ser IGUAL en la ficha y en la cola. Si cada sitio
 *   formatea por su cuenta, un día los dos disagrees y nadie sabe cuál manda.
 *
 * El formato es "vie 2 oct": corto para una etiqueta, y con el día de la
 * semana porque la semana de publicación es lo que el equipo planifica.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * MEDIDO 2026-10-01: la fecha se guarda como `2026-10-02T00:00:00.000Z`, es
 * decir medianoche UTC. Colombia es UTC-5, así que ese instante es el 1 de
 * octubre a las 7 de la tarde acá.
 *
 * Traducido: la primera versión pintaba "jue 1 oct" para una salida que el
 * equipo había programado para el 2. El test lo cazó, no yo.
 *
 * El arreglo es anclar el DÍA a la zona local y no al instante. Se lee el
 * `YYYY-MM-DD` del texto y se construye la fecha con hora local, que es como
 * la leyó un humano cuando la escribió. El texto plano es ambiguo y solo se
 * usa como respaldo.
 */
function diaLocal(iso: string): Date | null {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (soloFecha) {
    const [, a, m, d] = soloFecha;
    const fecha = new Date(Number(a), Number(m) - 1, Number(d));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `2026-10-02T00:00:00.000Z` → `vie 2 oct`. Inválido o vacío → `null`. */
export function fechaEs(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = diaLocal(iso);
  if (!d) return null;
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** `2026-10-02T00:00:00.000Z` → `2026-10-02`, para `<input type="date">`. */
export function fechaIsoCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = diaLocal(iso);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Qué tan lejos está la salida, para pintar una urgencia honesta.
 *
 * `null` cuando no hay fecha o ya pasó: una pieza vencida no se anuncia como
 * urgente, se anuncia como vencida, y eso lo decide otra cosa.
 */
export function cuantoPara(iso: string | null | undefined): { texto: string; vencido: boolean } | null {
  if (!iso) return null;
  const d = diaLocal(iso);
  if (!d) return null;

  const hoy = new Date();
  // Las dos fechas a medianoche local: comparar 00:00 con la hora actual hace
  // que "hoy" se lea como "en 0 días" o, peor, como vencido.
  d.setHours(0, 0, 0, 0);
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { texto: `hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`, vencido: true };
  if (dias === 0) return { texto: 'hoy', vencido: false };
  if (dias === 1) return { texto: 'mañana', vencido: false };
  return { texto: `en ${dias} días`, vencido: false };
}