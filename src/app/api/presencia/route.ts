import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { quienEs } from '@/lib/quien-es';

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
  // Con la clave del servidor. Antes usaba el cliente anónimo y sus políticas
  // comparaban con `auth.jwt() ->> 'email'`, que con la puerta por código
  // devuelve siempre NULL: el UPSERT no coincidía con ninguna fila y la
  // presencia no se guardaba. Nadie lo notaba porque el panel pinta "sin datos"
  // igual que "nadie conectado" — un fallo que se parece a una verdad.
  const supabase = await createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase no configurado.' }, { status: 503 });

  // La puerta es un código por cliente (2026-09-28), así que la identidad sale
  // de la cookie firmada y no de una sesión de Supabase.
  const sesion = await quienEs();
  if (!sesion) {
    return NextResponse.json({ error: 'Entra con el código de tu cliente.' }, { status: 401 });
  }
  const correo = sesion.email;

  let sesionId = '';
  try {
    const cuerpo = (await request.json()) as Latido;
    sesionId = typeof cuerpo.sesionId === 'string' ? cuerpo.sesionId.slice(0, 80) : '';
  } catch {
    // Un latido sin identificador sigue siendo un latido: se registra sin sesión.
  }

  const { data: perfil } = await supabase
    .from('rr_hub_profiles').select('id').ilike('email', correo).maybeSingle();

  const { error } = await supabase.from('rr_hub_presencia').upsert({
    email: correo,
    profile_id: perfil?.id ?? null,
    last_seen_at: new Date().toISOString(),
    sesion_id: sesionId || null,
  }, { onConflict: 'email' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Quién está conectado ahora.
 *
 * No existía un GET: el panel de presencia leía la tabla con el cliente anónimo
 * desde el navegador, y con el RLS cerrado devolvía `[]`. Es decir, la respuesta
 * era "nadie" y el panel lo pintaba como tal. Una lectura hecha por la persona
 * equivocada no es una lectura: es un cero con aspecto de dato.
 *
 * El filtro de la ventana va aquí, en el servidor. En el navegador sería lo
 * mismo de inefficiento y además dejaría el "quién está en línea" como una
 * decisión del cliente, que es justo lo que no debe ser.
 */
export async function GET() {
  const sesion = await quienEs();
  if (!sesion) return NextResponse.json({ error: 'Entra con el código de tu cliente.' }, { status: 401 });

  const supabase = await createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase no configurado.' }, { status: 503 });

  const desde = new Date(Date.now() - VENTANA_ONLINE_MS).toISOString();
  const { data, error } = await supabase
    .from('rr_hub_presencia')
    .select('email, profile_id, last_seen_at, sesion_id')
    .gte('last_seen_at', desde)
    .order('last_seen_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ventana_ms: VENTANA_ONLINE_MS, presencia: data ?? [] });
}
