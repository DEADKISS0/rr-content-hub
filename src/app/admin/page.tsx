import { redirect } from 'next/navigation';
import { quienEs } from '@/lib/quien-es';

/** Los accesos viven en /audit/admin, que exige ser administrador. */
export default async function AdminPage() {
  // Antes saltaba a `/wundeer` fijo, así que entrando con 2222 (Candilejas) te
  // echaba a Wundeer. Ahora sale el cliente de la cookie, que es el único sitio
  // donde se sabe cuál es.
  const sesion = await quienEs();
  // `/login` ya no existe (2026-10-02): sin cliente en la cookie se va a la
  // portada, que es donde está el catálogo. Antes esto devolvía un 404.
  redirect(sesion?.proyecto ? `/${sesion.proyecto}` : '/');
}
