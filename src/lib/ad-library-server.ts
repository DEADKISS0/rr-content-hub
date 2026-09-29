import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * La biblioteca de anuncios, leída del servidor.
 *
 * Qué es `rr_hub_ad_library`: un catálogo de piezas de contenido que ya
 * funcionaron, para no empezar cada idea desde cero. Nació de las 23
 * referencias que ya había en el hub (Instagram, Facebook, Drive) más las
 * piezas de pauta que no estaban catalogadas.
 *
 * Por qué va en el servidor y no en el cliente: es una lectura, pero de una
 * tabla que el navegador no debe tocar directamente (el guard de escritura
 * solo cubre `/api/workspace`), y porque el selector necesita el proyecto
 * actual, que en el cliente solo se sabe con una consulta extra.
 */

export type AdEntry = {
  id: string;
  name: string;
  platform: string;
  format: string;
  externalUrl: string;
  coverUrl: string | null;
  objective: string;
  copyText: string;
  brand: string;
  audience: string;
  metricsNote: string | null;
};

/**
 * Trae los anuncios activos del proyecto.
 *
 * `active = true` y no un filtro por fecha: un anuncio que se apagó sigue
 * siendo historia útil ("esto funcionó en diciembre"), pero no debe salir en el
 * selector al crear una idea nueva. Quien quiera ver los apagados los busca en
 * la pestaña de la biblioteca.
 */
export async function listarAnuncios(projectId: string): Promise<AdEntry[]> {
  const supabase = (await createServiceClient()) ?? (await createClient());
  // `createClient` devuelve null si faltan las variables del despliegue. Un null
  // sin avisar deja el selector con "no hay anuncios" y parece que la biblioteca
  // está vacía, cuando lo que falta son las variables.
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('rr_hub_ad_library')
    .select(
      'id, name, platform, format, external_url, cover_url, objective, copy_text, brand, audience, metrics_note',
    )
    .eq('project_id', projectId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((fila) => ({
    id: fila.id,
    name: fila.name,
    platform: fila.platform,
    format: fila.format,
    externalUrl: fila.external_url,
    coverUrl: fila.cover_url,
    objective: fila.objective,
    copyText: fila.copy_text,
    brand: fila.brand,
    audience: fila.audience,
    metricsNote: fila.metrics_note,
  }));
}

/**
 * Los anuncios que ya están en uso, para que el selector diga "esto ya se usó
 * en 3 ideas" y no se repita la misma referencia sin querer.
 */
export async function anunciosEnUso(projectId: string): Promise<Map<string, number>> {
  const supabase = (await createServiceClient()) ?? (await createClient());
  if (!supabase) return new Map();
  const { data } = await supabase
    .from('rr_hub_ideas')
    .select('ad_id')
    .eq('project_id', projectId)
    .not('ad_id', 'is', null);
  const conteo = new Map<string, number>();
  for (const fila of data ?? []) {
    if (fila.ad_id) conteo.set(fila.ad_id, (conteo.get(fila.ad_id) ?? 0) + 1);
  }
  return conteo;
}
