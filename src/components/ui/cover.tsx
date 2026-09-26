import { Icon, type IconName } from './icons';

/**
 * Formatos de pieza del hub. Uno por cada tipo real que se produce: orgánico
 * corto, carrusel, foto, video largo y pauta. El ícono + la etiqueta viajan
 * juntos porque el color solo nunca cuenta la historia completa.
 */
export const FORMATS = [
  { key: 'reel', label: 'REEL', icon: 'video' as IconName },
  { key: 'carrusel', label: 'CARRUSEL', icon: 'stack' as IconName },
  { key: 'foto', label: 'FOTO', icon: 'image' as IconName },
  { key: 'video', label: 'VIDEO', icon: 'camera' as IconName },
  { key: 'pauta', label: 'PAUTA', icon: 'target' as IconName },
  { key: 'guion', label: 'GUION', icon: 'pen' as IconName },
] as const;

export type FormatKey = (typeof FORMATS)[number]['key'];

/** Deduce el formato a partir de la categoría guardada, sin inventar datos. */
export function formatOf(category?: string | null, contentType?: string | null): (typeof FORMATS)[number] {
  const raw = `${category ?? ''} ${contentType ?? ''}`.toLowerCase();
  const found = FORMATS.find((format) => raw.includes(format.key));
  if (found) return found;
  if (raw.includes('paid') || raw.includes('pauta')) return FORMATS[4];
  if (raw.includes('reel')) return FORMATS[0];
  return FORMATS[2];
}

/**
 * Portada procedural de una pieza.
 *
 * El hub es una herramienta visual y hasta hoy cada tarjeta era solo texto: no
 * había dónde poner el ojo. En vez de depender de archivos subidos (que aún no
 * existen en el bucket), cada pieza recibe una portada determinista construida
 * con su código y su título: mismo código, misma portada, siempre. Es un asset
 * real y reproducible, no un adorno aleatorio.
 */
const PALETTE = ['#be076d', '#ded116', '#973d8f', '#fffff3'] as const;

function hash(text: string): number {
  let h = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    h ^= text.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Geometry = 'stripes' | 'grid' | 'arcs' | 'blocks' | 'rays' | 'orbit';
const GEOMETRIES: Geometry[] = ['stripes', 'grid', 'arcs', 'blocks', 'rays', 'orbit'];

function Art({ geometry, ink, alt }: { geometry: Geometry; ink: string; alt: string }) {
  /**
   * Redondeo obligatorio en la geometría con trigonometría: `Math.cos/sin`
   * devuelven flotantes con distinto último dígito en Node y en el navegador, y
   * eso rompía la hidratación (el `d` del server no coincidía con el del
   * cliente). Redondeado a dos decimales, el trazo es idéntico en ambos lados.
   */
  const round = (value: number) => Math.round(value * 100) / 100;
  switch (geometry) {
    case 'stripes':
      return <g stroke={ink} strokeWidth="10" opacity="0.9">{[0, 1, 2, 3, 4, 5].map((index) => <path key={index} d={`M${-40 + index * 46} 200L${index * 60} 0`} />)}</g>;
    case 'grid':
      return <g stroke={ink} strokeWidth="6" opacity="0.85">{[0, 1, 2, 3, 4].map((index) => <path key={`v${index}`} d={`M${index * 56 + 12} 0v180`} />)}{[0, 1, 2].map((index) => <path key={`h${index}`} d={`M0 ${index * 56 + 12}h260`} />)}</g>;
    case 'arcs':
      return <g stroke={ink} strokeWidth="9" fill="none" opacity="0.9">{[40, 80, 120, 160].map((radius, index) => <circle key={radius} cx="210" cy="150" r={radius} stroke={index % 2 ? alt : ink} />)}</g>;
    case 'blocks':
      return <g fill={ink} opacity="0.92"><rect x="24" y="90" width="70" height="70" /><rect x="110" y="40" width="52" height="120" /><rect x="180" y="110" width="64" height="50" /></g>;
    case 'rays':
      return <g stroke={ink} strokeWidth="7" opacity="0.9">{Array.from({ length: 9 }).map((_, index) => { const angle = (index / 9) * Math.PI * 2; return <path key={index} d={`M160 90L${round(160 + Math.cos(angle) * 220)} ${round(90 + Math.sin(angle) * 220)}`} />; })}</g>;
    default:
      return <g opacity="0.95"><circle cx="200" cy="52" r="46" stroke={ink} strokeWidth="9" fill="none" /><circle cx="200" cy="52" r="16" fill={alt} /></g>;
  }
}

export function IdeaCover({ code, title, size = 'md', format }: { code?: string | null; title: string; size?: 'sm' | 'md' | 'lg'; format?: IconName }) {
  const seed = hash(`${code ?? ''}${title}`);
  const geometry = GEOMETRIES[seed % GEOMETRIES.length];
  const ink = PALETTE[seed % 3];
  const alt = seed % 2 ? '#fffff3' : '#ded116';
  const heightClass = size === 'sm' ? 'h-16' : size === 'lg' ? 'h-44' : 'h-24';

  return (
    <div className={`cover-frame relative ${heightClass} w-full overflow-hidden border border-blanco-20 bg-negro`}>
      <svg viewBox="0 0 260 180" preserveAspectRatio="none" className="cover-art h-full w-full" aria-hidden="true">
        <rect width="260" height="180" fill="#070001" />
        <Art geometry={geometry} ink={ink} alt={alt} />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-negro via-negro/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-blanco">{code ?? 'IDEA'}</span>
        {format && <span className="border border-blanco-30 bg-negro/80 p-1 text-blanco"><Icon name={format} size={12} /></span>}
      </div>
    </div>
  );
}
