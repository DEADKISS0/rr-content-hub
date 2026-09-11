import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccessAdmin } from '@/components/access-admin';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login?next=/admin');
    const { data: profile } = await supabase.from('rr_hub_profiles').select('global_role').eq('id', user.id).maybeSingle();
    if (profile?.global_role !== 'admin') redirect('/no-access');
  }
  return <main className="min-h-screen bg-negro"><div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 md:py-16"><Link href="/select-project" className="font-mono text-xs text-blanco-60 hover:text-mostaza">← VOLVER A PROYECTOS</Link><header className="mb-10 mt-8 border-b border-blanco-10 pb-9"><p className="eyebrow">[RR CONTENT HUB · ADMIN]</p><h1 className="display-title">CONTROL<br/><em>DE ACCESO.</em></h1><p className="mt-5 max-w-2xl text-base leading-8 text-blanco-60">Una sola fuente de verdad para asignar proyectos, responsabilidades y límites de cada persona.</p></header><AccessAdmin /></div></main>;
}
