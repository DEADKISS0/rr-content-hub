import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-negro">
    <header className="sticky top-0 z-20 border-b-2 border-mostaza bg-negro/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-10">
        <Link href="/wundeer" className="font-mono text-[10px] leading-5 text-blanco">[AUDITORÍA · SOLO LECTURA] <span className="text-mostaza">Acceso completo, sin credenciales. Se ve todo, no se edita nada.</span></Link>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/audit/wundeer" className="font-mono text-[10px] text-blanco-60 transition-colors hover:text-mostaza">PROYECTO</Link>
          <Link href="/audit/admin" className="font-mono text-[10px] text-blanco-60 transition-colors hover:text-mostaza">ADMIN</Link>
          <Link href="/wundeer" className="font-mono text-[10px] text-mostaza underline">VOLVER AL TABLERO →</Link>
        </nav>
      </div>
    </header>
    {children}
  </div>;
}
