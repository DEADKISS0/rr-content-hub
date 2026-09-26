import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export type ChipTone = 'neutro' | 'mostaza' | 'fucsia' | 'orquidea' | 'blanco';

const CHIP_SKIN: Record<ChipTone, string> = {
  neutro: 'border-blanco-20 text-blanco-50',
  mostaza: 'border-mostaza text-mostaza',
  fucsia: 'border-fucsia text-fucsia',
  orquidea: 'border-orquidea text-orquidea',
  blanco: 'border-blanco text-blanco',
};

/** Chip mono con ícono opcional. Es la pieza de información más pequeña del hub. */
export function Chip({ children, icon, tone = 'neutro', title, className = '' }: { children: ReactNode; icon?: IconName; tone?: ChipTone; title?: string; className?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${CHIP_SKIN[tone]} ${className}`}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

/** Iniciales dentro de un cuadro. Reemplaza al "quién" abstracto por una cara. */
export function Initials({ label, tone = 'neutro', size = 26 }: { label: string; tone?: ChipTone; size?: number }) {
  const initials = label
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || 'RR';
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center border font-mono text-[10px] font-bold ${CHIP_SKIN[tone]}`}
    >
      {initials}
    </span>
  );
}

const ROLE_TONE: Record<string, ChipTone> = {
  CREATIVA: 'mostaza', CREATIVE: 'mostaza', OWNER: 'blanco', CLIENTE: 'mostaza',
  CÁMARA: 'fucsia', CAMARA: 'fucsia', MODELO: 'fucsia', EDITOR: 'orquidea',
  PUBLISHER: 'fucsia', PAUTA: 'orquidea', 'RR ALIADOS': 'neutro',
};

const ACTOR_TEXT: Record<ChipTone, string> = {
  neutro: 'text-blanco', mostaza: 'text-mostaza', fucsia: 'text-fucsia', orquidea: 'text-orquidea', blanco: 'text-blanco',
};

/** A quién le toca actuar: iniciales + rol, con tono estable por rol. */
export function ActorChip({ who, prefix = 'ACTÚA' }: { who: string; prefix?: string }) {
  const first = who.split(/[·|]/)[0].trim();
  const tone = ROLE_TONE[first.toUpperCase()] ?? 'neutro';
  return (
    <span className="inline-flex items-center gap-2">
      <Initials label={first} tone={tone} size={22} />
      <span className="font-mono text-[10px] uppercase leading-3 tracking-[0.08em] text-blanco-50">
        {prefix}<br /><b className={`text-[10px] ${ACTOR_TEXT[tone]}`}>{first}</b>
      </span>
    </span>
  );
}

/** Contador numérico grande, para cabeceras de columna y KPIs. */
export function BigCount({ value, label, tone = 'blanco' }: { value: number | string; label: string; tone?: ChipTone }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <b className={`font-display text-3xl font-bold leading-none ${tone === 'mostaza' ? 'text-mostaza' : tone === 'fucsia' ? 'text-fucsia' : tone === 'orquidea' ? 'text-orquidea' : 'text-blanco'}`}>{value}</b>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-blanco-50">{label}</span>
    </span>
  );
}
