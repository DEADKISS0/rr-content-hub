import { redirect } from 'next/navigation';

/** Authentication is intentionally disabled for the current Wundeer pilot. */
export default function LoginPage() { redirect('/wundeer'); }
