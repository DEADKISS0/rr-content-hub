import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-negro">
    <header className="border-b-2 border-mostaza bg-mostaza/10 px-5 py-4 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Link href="/audit" className="font-mono text-[10px] leading-5 text-blanco">[MODO AUDITORÍA · SOLO LECTURA] Copia pública sin iniciar sesión: se ve todo, no se edita nada.</Link>
        <Link href="/login" className="font-mono text-[10px] text-mostaza underline">ENTRAR CON GOOGLE →</Link>
      </div>
    </header>
    {children}
  </div>;
}
