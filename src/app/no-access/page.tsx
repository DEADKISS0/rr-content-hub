import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

/** Sin proyectos asignados. Se explica en claro y se ofrece la salida. */
export default function NoAccess() {
  return (
    <main className="grid min-h-screen place-items-center bg-negro p-5">
      <div className="w-full max-w-lg border-2 border-mostaza p-8 text-center anim-rise">
        <span className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-mostaza text-mostaza">
          <Icon name="alert" size={20} />
        </span>
        <p className="eyebrow mt-5">[RR CONTENT HUB · ACCESO]</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-blanco">SIN ACCESO</h1>
        <p className="mt-4 font-mono text-[10px] leading-6 text-blanco-60">
          TU CUENTA NO TIENE PROYECTOS ASIGNADOS.<br />
          PÍDELE AL ADMINISTRADOR DE RR ALIADOS QUE TE HABILITE UNO.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-brutal inline-flex items-center gap-2">VOLVER AL INICIO <Icon name="arrow" size={14} /></Link>
          <Link href="/select-project" className="border-2 border-blanco-20 px-5 py-3 font-mono text-[11px] text-blanco-60 transition-colors hover:border-blanco hover:text-blanco">VER PROYECTOS</Link>
        </div>
      </div>
    </main>
  );
}
