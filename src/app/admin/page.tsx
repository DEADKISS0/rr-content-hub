import { redirect } from 'next/navigation';

/** Public mode: the roster now lives in the audit panel, always readable. */
export default function AdminPage() {
  redirect('/audit/admin');
}
