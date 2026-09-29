import Link from 'next/link';
import { quienEs } from '@/lib/quien-es';
import { getProjects } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * La auditoría es de solo lectura, pero la puerta es la misma que la del tablero.
 *
 * Antes este encabezado tenía `/wundeer` escrito tres veces, así que entrando con
 * 2222 (Candilejas) el enlace de "volver al tablero" te sacaba a Wundeer: un
 * enlace que funcionaba y llevaba al cliente equivocado, que es peor que un
 * enlace roto. Los tres salen ahora del cliente de la cookie, que es el único
 * sitio donde se sabe cuál es.
 */
export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const sesion = await quienEs();
  const { projects } = await getProjects();
  const fila: any = projects[0];
  const anidado: any = fila?.projects ?? fila;
  const primero: any = Array.isArray(anidado) ? anidado[0] : anidado;
  // Sin cookie no hay cliente: se ofrece entrar en vez de apuntar a un proyecto
  // inventado que solo daría un 404.
  const slug: string | null = sesion?.proyecto ?? primero?.slug ?? null;

  return <div className="min-h-screen bg-negro">
    <header className="sticky top-0 z-20 border-b border-blanco-20 bg-negro/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-10">
        <span className="font-mono text-[10px] leading-5 text-blanco">[AUDITORÍA · SOLO LECTURA] <span className="text-blanco-60">Acceso completo, sin credenciales. Se ve todo, no se edita nada.</span></span>
        <nav className="flex flex-wrap items-center gap-4">
          {slug ? <>
            <Link href={`/audit/${slug}`} className="font-mono text-[10px] text-blanco-60 transition-colors hover:text-blanco">PROYECTO</Link>
            <Link href="/audit/admin" className="font-mono text-[10px] text-blanco-60 transition-colors hover:text-blanco">ADMIN</Link>
            <Link href={`/${slug}`} className="font-mono text-[10px] text-blanco-60 underline hover:text-blanco">VOLVER AL TABLERO →</Link>
          </> : <Link href="/login" className="font-mono text-[10px] text-blanco-60 underline hover:text-blanco">ENTRAR CON TU CÓDIGO →</Link>}
        </nav>
      </div>
    </header>
    {children}
  </div>;
}
