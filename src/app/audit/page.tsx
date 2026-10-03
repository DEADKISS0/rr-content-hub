import { redirect } from 'next/navigation';
import { getProjects } from '@/lib/data';
import { quienEs } from '@/lib/quien-es';

/**
 * La auditoría no tiene índice: se entra al cliente del código con el que te
 * logueaste.
 *
 * Antes esto mandaba a `/wundeer` fijo, así que entrando con 2222 (Candilejas)
 * la auditoría te Depositaba en Wundeer. No era un enlace roto: era un enlace
 * que te llevaba al cliente equivocado, que es peor.
 */
export default async function AuditIndex() {
  const sesion = await quienEs();
  if (sesion?.proyecto) redirect(`/audit/${sesion.proyecto}`);
  const { projects } = await getProjects();
  const fila: any = projects[0];
  const anidado: any = fila?.projects ?? fila;
  const primero: any = Array.isArray(anidado) ? anidado[0] : anidado;
  // Sin clientes no hay a dónde ir, y `/login` ya no existe (2026-10-02): un
  // rebote ahí sería un 404 para quien llega. Se dice que no hay nada que ver.
  if (!primero?.slug) {
    return (
      <main className="min-h-screen bg-negro">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h1 className="display-title">Todavía no hay clientes.</h1>
          <p className="mt-6 text-blanco-60">
            La auditoría está abierta, pero no hay ningún cliente dado de alta. Cuando se
            cree el primero, su trazabilidad aparece aquí.
          </p>
        </div>
      </main>
    );
  }
  redirect(`/audit/${primero.slug}`);
}
