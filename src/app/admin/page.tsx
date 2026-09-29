import { redirect } from 'next/navigation';
import { quienEs } from '@/lib/quien-es';

/** Los accesos viven en /audit/admin, que exige ser administrador. */
export default async function AdminPage() {
  // Antes saltaba a `/wundeer` fijo, así que entrando con 2222 (Candilejas) te
  // echaba a Wundeer. Ahora sale el cliente de la cookie, que es el único sitio
  // donde se sabe cuál es.
  const sesion = await quienEs();
  redirect(sesion?.proyecto ? `/${sesion.proyecto}` : '/login');
}
