/**
 * GET /api/workspace/votos?proyecto=wundeer — el estado de las votaciones, en vivo.
 *
 * MEDIDO 2026-10-03. Lo que había: el contador de votos se leía al pintar la
 * página, con un Server Component. Votaba una persona, el número le llegaba a su
 * pantalla, y el resto del equipo seguía viendo el número viejo hasta que
 * recargaba. En una votación de equipo eso es un problema real: se debate una
 * idea "con 2 sí" y en dos pantallas hay "3 sí".
 *
 * Este endpoint devuelve solo lo que cambia — el conteo de las ideas en
 * votación — para que el navegador lo consulte cada pocos segundos. Es una
 * lectura, no una escritura: no toca roles ni estados.
 *
 * Por qué no SSE ni WebSocket: la respuesta se puede resolver con una consulta
 * y un `max-age` de un par de segundos. Una conexión abierta por cliente sería
 * 18 conexiones de Vercel para mirar tres números. Si algún día hace falta
 * empuje de verdad, este endpoint sigue siendo la fuente y lo que cambia es solo
 * cómo se le avisa al cliente.
 */
import { NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/service';
import { VOTOS_NECESARIOS } from '@/lib/flow';

export const dynamic = 'force-dynamic';

/**
 * Cuánto tiempo el navegador puede esperar antes de volver a preguntar.
 *
 * Diez segundos es un punto medio medido contra el caso real: una votación de
 * equipo son 3-5 personas y cada una vota una vez. Con 10 s, quien acaba de
 * pulsar ve el cambio de los demás en un tiempo imperceptible, y el hub sigue
 * siendo unas peticiones pequeñas en vez de un socket abierto.
 */
const CACHE_SEGUNDOS = 10;

/**
 * Los conteos de las ideas en votación de UN cliente.
 *
 * MEDIDO 2026-10-03: `rr_hub_votes` NO tiene columna `project_id`. Solo tiene
 * `idea_id`, así que el proyecto se resuelve cruzando por la idea. Filtrar por
 * `project_id` sobre `rr_hub_votes` no da error: PostgREST lo ignora y devuelve
 * los votos de OTROS clientes, que es peor que un fallo.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const proyecto = new URL(request.url).searchParams.get('proyecto');
  if (!proyecto) {
    return NextResponse.json({ error: 'Falta el proyecto.' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'El servidor no tiene Supabase.' }, { status: 500 });
  }

  const { data: ideas, error: ideasError } = await supabase
    .from('rr_hub_ideas')
    .select('id')
    .eq('project_id', await idDeProyecto(supabase, proyecto))
    .eq('status', 'voting');
  if (ideasError) return NextResponse.json({ error: ideasError.message }, { status: 500 });

  const ids = (ideas ?? []).map((i: { id: string }) => i.id as string);
  if (!ids.length) {
    return NextResponse.json({ votos: {} }, { headers: cacheHeaders() });
  }

  const { data: votos, error: votosError } = await supabase
    .from('rr_hub_votes')
    .select('idea_id, decision, voter_email, created_at')
    .in('idea_id', ids);
  if (votosError) return NextResponse.json({ error: votosError.message }, { status: 500 });

  const porIdea: Record<string, { aFavor: number; enContra: number; cambios: number; total: number; ultimo: string | null }> = {};
  for (const id of ids) {
    porIdea[id] = { aFavor: 0, enContra: 0, cambios: 0, total: 0, ultimo: null };
  }

  let masReciente: string | null = null;
  for (const v of votos ?? []) {
    const id = v.idea_id as string;
    // Una idea que se dejó de votar en medio de la lectura (alguien votó y la
    // votación se decidió en el mismo instante) puede venir aquí sin fila
    // propia. Se ignora en vez de inventarle un cero que parecería real.
    if (!porIdea[id]) continue;
    porIdea[id].total += 1;
    if (v.decision === 'yes') porIdea[id].aFavor += 1;
    if (v.decision === 'no') porIdea[id].enContra += 1;
    if (v.decision === 'change') porIdea[id].cambios += 1;
    const creado = v.created_at as string | null;
    if (creado && (!masReciente || creado > masReciente)) masReciente = creado;
  }

  return NextResponse.json(
    { votos: porIdea, minimo: VOTOS_NECESARIOS, serverTime: new Date().toISOString() },
    { headers: cacheHeaders() },
  );
}

/**
 * `project_id` a partir del slug. Vive en una función porque el filtro del
 * `.in()` de arriba necesita el UUID, no el slug.
 */
async function idDeProyecto(supabase: Awaited<ReturnType<typeof createServiceClient>>, slug: string): Promise<string> {
  if (!supabase) return '';
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return (data?.id as string) ?? '';
}

/**
 * La caché del navegador es de 10 s: es lo que evita que 18 pestañas abiertas
 * hagan 18 consultas por segundo. No es caché de servidor: cada despliegue
 * distinto o cada cambio de voto tiene que verse, y con estos 10 s se ve.
 */
function cacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': `private, max-age=${CACHE_SEGUNDOS}, stale-while-revalidate=5`,
  };
}