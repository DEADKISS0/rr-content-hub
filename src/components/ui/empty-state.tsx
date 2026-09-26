import Link from 'next/link';
import { Icon, type IconName } from './icons';

/**
 * Estado vacío con acción. Un hueco en el tablero no debe ser una disculpa:
 * debe decir qué falta y ofrecer el botón que lo resuelve.
 */
export function EmptyState({ icon = 'pieces', title, hint, action }: { icon?: IconName; title: string; hint: string; action?: { href: string; label: string } }) {
  return (
    <div className="relative flex flex-col items-center gap-3 border border-dashed border-blanco-20 px-4 py-8 text-center">
      <span className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <path d="M0 100L100 0M30 100L100 30M0 70L70 0" stroke="#fffff3" strokeWidth="1" fill="none" />
        </svg>
      </span>
      <span className="flex h-10 w-10 items-center justify-center border border-blanco-20 text-blanco-30"><Icon name={icon} size={18} /></span>
      <p className="font-display text-base font-bold text-blanco-60">{title}</p>
      <p className="max-w-[16rem] text-[11px] leading-4 text-blanco-60">{hint}</p>
      {action && <Link href={action.href} className="mt-1 inline-flex items-center gap-2 border border-mostaza px-3 py-2 font-mono text-[10px] text-mostaza transition-colors hover:bg-mostaza hover:text-negro"><Icon name="plus" size={12} />{action.label}</Link>}
    </div>
  );
}
