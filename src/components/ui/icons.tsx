import type { ReactNode, SVGProps } from 'react';

/**
 * B.U.C.M. icon set — trazo de 2px, esquinas duras, sin relleno.
 *
 * Propio a propósito: el hub no debe depender de una librería de íconos para
 * hablar su idioma. Todos heredan `currentColor`, así que el tono lo pone el
 * contexto (fucsia = acción, mostaza = atención, orquídea = revisión).
 */
export type IconName =
  | 'map' | 'pieces' | 'decisions' | 'camera' | 'publish' | 'roadmap'
  | 'search' | 'filter' | 'grid' | 'list' | 'calendar'
  | 'plus' | 'chevron' | 'arrow' | 'clock' | 'link' | 'image' | 'video' | 'stack'
  | 'spark' | 'user' | 'alert' | 'check' | 'close' | 'chart' | 'file' | 'comment'
  | 'upload' | 'target' | 'bolt' | 'eye' | 'pin' | 'pen' | 'scissors' | 'flag'
  | 'leaf' | 'lock';

const PATHS: Record<IconName, ReactNode> = {
  map: <><rect x="3" y="4" width="18" height="16" /><path d="M9 4v16M15 4v16" /></>,
  pieces: <><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" /><path d="M3 12.5L12 17l9-4.5" /><path d="M3 16.5L12 21l9-4.5" /></>,
  decisions: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  camera: <><rect x="2" y="7" width="13" height="11" /><path d="M15 11.5L22 8v9l-7-3.5z" /></>,
  publish: <><path d="M3 12l18-8-8 18-2-8-8-2z" /></>,
  roadmap: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6h5a4 4 0 010 8h-3a4 4 0 000 8" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5L21 21" /></>,
  filter: <><path d="M3 5h18l-7 8v7l-4-2v-5z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  list: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <><path d="M9 5l7 7-7 7" /></>,
  arrow: <><path d="M4 12h14M13 6l6 6-6 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
  link: <><path d="M9.5 14.5l5-5" /><path d="M7 12l-2 2a4 4 0 006 6l2-2" /><path d="M17 12l2-2a4 4 0 00-6-6l-2 2" /></>,
  image: <><rect x="3" y="4" width="18" height="16" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="9" cy="9" r="1.5" /></>,
  video: <><rect x="3" y="5" width="18" height="14" /><path d="M10 9l5 3-5 3z" /></>,
  stack: <><rect x="3" y="8" width="13" height="13" /><path d="M7 3h14v14" /></>,
  spark: <><path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></>,
  alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  check: <><path d="M5 13l4 4L19 7" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  // Candado para lo que existe pero no se puede abrir (un cliente sin acceso).
  // Sin relleno, con la anilla encima del cuerpo: si se rellenara, el hueco de la
  // anilla se perdería y se leería como un cuadrado más.
  lock: <><rect x="5" y="11" width="14" height="10" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4" /></>,
  comment: <><path d="M4 5h16v11H9l-5 4z" /></>,
  upload: <><path d="M12 17V5M6 11l6-6 6 6" /><path d="M4 21h16" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  bolt: <><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></>,
  eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  pen: <><path d="M4 20l3-1 11-11-2-2L5 17z" /><path d="M15 6l2 2" /></>,
  scissors: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 7.5L20 19M8 16.5L20 5" /></>,
  flag: <><path d="M5 21V4h11l-2 4 2 4H5" /></>,
  leaf: <><path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9z" /><path d="M12 7v10M8 11l4-4 4 4" /></>,
};

export function Icon({ name, size = 16, className, strokeWidth = 2, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Ícono con etiqueta mono, la unidad mínima de la interfaz. */
export function IconLabel({ name, children, className = '', size = 13 }: { name: IconName; children: ReactNode; className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] ${className}`}>
      <Icon name={name} size={size} />
      {children}
    </span>
  );
}
