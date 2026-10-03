/**
 * GET /api/workspace/equipo?proyecto=wundeer — quién puede votar en este cliente.
 *
 * MEDIDO 2026-10-03. El selector de perfil solo vivía en la ficha de una pieza y en
 * la pantalla de votación, y en la barra había un ENLACE que llevava a la pantalla
 * de votación. MEDIDO en producción: en el tablero no había forma de cambiar de
 * perfil sin salirse de donde estás. «No deja cambiar el perfil» era eso: desde el
 * tablero no había con qué.
 *
 * Se lee aquí, y no se pasa por props, por una razón práctica: `WorkspaceShell` lo
 * usan ocho pantallas y cada una tendría que pedir el equipo. Un fetch en el propio
 * selector lo resuelve una vez, y la barra y la ficha muestran la misma lista sin
 * que una dependa de la otra.
 *
 * Es una lectura del equipo que ya puede votar —nombres y correos de gente que está
 * en `rr_hub_profiles` con `is_team_member` e `is_active`— que la pantalla de
 * votación ya muestra. No añade acceso a nada que no estuviera a la vista.
 */
import { NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const proyecto = new URL(request.url).searchParams.get('proyecto');
  if (!proyecto) {
    return NextResponse.json({ error: 'Falta el proyecto.' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'El servidor no tiene Supabase.' }, { status: 500 });
  }

  const { data: fila, error: proyectoError } = await supabase
    .from('rr_hub_projects')
    .select('id')
    .eq('slug', proyecto)
    .maybeSingle();
  if (proyectoError) {
    return NextResponse.json({ error: proyectoError.message }, { status: 500 });
  }
  if (!fila) {
    return NextResponse.json({ error: 'Ese cliente no existe.' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('rr_hub_profiles')
    .select('email, full_name')
    .eq('is_team_member', true)
    .eq('is_active', true)
    .order('full_name');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const equipo = (data ?? [])
    .map((p: { email?: string; full_name?: string }) => ({
      email: String(p.email ?? '').trim(),
      nombre: String(p.full_name ?? '').trim() || String(p.email ?? '').trim(),
    }))
    // Un perfil sin correo no se puede comprobar contra la base al votar: si se
    // ofreciera, el servidor lo rechazaría y el elector no entendería por qué.
    .filter((p: { email: string }) => p.email.length > 0);

  return NextResponse.json(
    { equipo },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}