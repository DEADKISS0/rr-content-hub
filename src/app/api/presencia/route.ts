import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * El latido: quién está conectado ahora mismo.
 *
 * Sin esto, la ficha de una pieza no puede decir "el equipo está encima". El
 * usuario lo pidió explícitamente: ver quién está en línea para saber a quién
 * preguntarle antes de votar.
 *
 * Por qué un endpoint y no una columna: "en línea" es una propriété del
 * TIEMPO, no un estado. La columna `last_seen_at` guarda el último latido; quién
 * está conectado se decide comparando contra una ventana (5 minutos). Guardar
 * un booleano `en_linea` obliga a tener un proceso que lo apagara, y ese
 * proceso siempre se cae y deja a gente "conectada" tres días después de
 * cerrar el portátil.
 *
 * Cuesta un POST por navegador abierto. Es lo que hace Google Docs, Slack y
 * cualquier otra cosa que pins de presencia, y son unos pocos cientos de bytes.
 */

const VENTANA_ONLINE_MS = 5 * 60 * 1000;

/** El navegador manda su identificador de sesión para poder excluir la suya. */
export type Latido = { sesionId?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase no configurado.' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Necesitas una sesión.' }, { status: 401 });
  }

  let sesionId = '';
  try {
    const cuerpo = (await request.json()) as Latido;
    sesionId = typeof cuerpo.sesionId === 'string' ? cuerpo.sesionId.slice(0, 80) : '';
  } catch {
    // Un latido sin identificador sigue siendo un latido: se registra sin sesión.
  }

  const { data: perfil } = await supabase
    .from('rr_hub_profiles').select('id').eq('email', user.email).maybeSingle();

  const { error } = await supabase.from('rr_hub_presencia').upsert({
    email: user.email.toLowerCase(),
    profile_id: perfil?.id ?? null,
    last_seen_at: new Date().toISOString(),
    sesion_id: sesionId || null,
  }, { onConflict: 'email' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
