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
  redirect(primero?.slug ? `/audit/${primero.slug}` : '/login');
}
