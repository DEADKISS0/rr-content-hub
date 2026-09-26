import { redirect } from 'next/navigation';

/** Los accesos viven en /audit/admin, que ahora exige ser administrador. */
export default function AdminPage() {
  redirect('/wundeer');
}
