import { estaArchivado } from './proyecto-archivado';

/**
 * Los clientes que el hub enseña.
 *
 * DESDE 2026-10-02: LA BASE ES LA LISTA.
 *
 * QUE PASABA, Y POR QUE ERA UN BUG DE VERDAD
 *
 * Este archivo tenía `CLIENTES_CONOCIDOS = ['wundeer', 'candilejas']`: una lista
 * fija de DOS clientes, escrita a mano. En la base hay CUATRO (BOGA, Candilejas,
 * Satiro Sushi y Wundeer), y la lista se quedó atrás cuando se dieron de alta
 * BOGA y Satiro.
 *
 * La consecuencia medida en producción, con la puerta ya abierta:
 *
 *   200  /candilejas
 *   200  /wundeer
 *   404  /boga           <- existe, tiene ideas, y no se podía abrir
 *   404  /satiro         <- ídem
 *
 * Y lo peor: la portada abría el primer cliente por orden alfabético, que era
 * BOGA, y su propio enlace llevaba a un 404. Una portada que ofrece un enlace
 * que no abre.
 *
 * POR QUE NO SE "ARREGLA" AÑADIENDO LOS DOS NOMBRES
 *
 * Porque es la misma clase de bug, dos meses más tarde. Una lista de clientes
 * escrita a mano es una promesa de que no se la va a actualizar, y ya falló una
 * vez. Con la puerta abierta, la pregunta ya no es "qué clientes hay" sino
 * "qué clientes hay en la base", y esa la responde la base con una consulta.
 *
 * LO QUE SE MANTIENE, Y POR QUE
 *
 * El filtro sigue existiendo: un `?projectSlug=inventado` tiene que dar 404 y no
 * una pantalla vacía. Lo que cambia es de dónde sale la respuesta.
 *
 * `clienteExiste` es async porque consulta. Eso obliga a los cinco sitios que la
 * usaban a esperar, y eso es lo correcto: la lista ya no está en el código, y
 * quien la use tiene que enterarse de que hay una base detrás.
 */

/**
 * ¿Existe este cliente?
 *
 * Consulta `rr_hub_projects` por service role, que es lo que ya usan el resto de
 * `lib/data.ts` para leer proyectos. Un slug que no existe en la base da 404: ni
 * una página vacía, ni un error de permisos, ni un mensaje que diga "no hay
 * proyectos".
 *
 * Y una fila que exista NO significa que se pueda escribir: eso lo decide
 * `rr_hub_access` en el guard de cada mutación, que es un sitio distinto y sigue
 * cerrado.
 */
export async function clienteExiste(slug?: string | null): Promise<boolean> {
  if (!slug) return false;
  const slugNormalizado = slug.trim().toLowerCase();
  const { DEMO_MODE } = await import('./demo-mode');
  if (DEMO_MODE) {
    const { getDemoProject } = await import('./demo-data');
    return Boolean(getDemoProject(slugNormalizado));
  }
  const { createServiceClient } = await import('./supabase/service');
  const supabase = await createServiceClient();
  if (!supabase) {
    // Sin service key no se puede comprobar. Se devuelve false, que es la
    // respuesta conservadora: antes devolvía la lista fija y mentia lo mismo que no
    // comprobar nada. Un 404 no es una mentira, es una ausencia de datos.
    return false;
  }
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('slug, archived_at')
    .eq('slug', slugNormalizado)
    .maybeSingle();
  if (!data) return false;
  // Un cliente archivado no abre ruta, salvo para el admin global, que sí lo ve.
  if (estaArchivado(data.archived_at) && !(await puedeVerArchivados())) return false;
  return true;
}

/**
 * ¿La sesión es de un admin global?
 *
 * El admin sigue viendo los clientes archivados, marcados. Un visitante sin
 * sesión, y cualquiera que no sea admin, no. El super-admin de configuración
 * cuenta igual: es la misma red de emergencia que el resto de los guards.
 */
export async function puedeVerArchivados(): Promise<boolean> {
  const { quienEs } = await import('./quien-es');
  const sesion = await quienEs();
  if (!sesion?.email) return false;
  const { esSuperAdmin } = await import('./config');
  if (esSuperAdmin(sesion.email)) return true;
  const { createServiceClient } = await import('./supabase/service');
  const { createClient } = await import('./supabase/server');
  const supabase = (await createServiceClient()) ?? (await createClient());
  if (!supabase) return false;
  const { data } = await supabase
    .from('rr_hub_profiles')
    .select('global_role')
    .ilike('email', sesion.email)
    .maybeSingle();
  return data?.global_role === 'admin';
}

/**
 * El id de un cliente que esta sesión puede abrir.
 *
 * La clave de servicio no mira el RLS, así que la ruta que resuelve un slug
 * tiene que repetir la regla aquí: archivado y no admin → no hay proyecto.
 */
export async function idDeProyectoVisible(
  supabase: { from: (tabla: string) => any },
  slug: string,
): Promise<string | null> {
  const slugNormalizado = slug.trim().toLowerCase();
  if (!slugNormalizado) return null;
  const { data } = await supabase
    .from('rr_hub_projects')
    .select('id, archived_at')
    .eq('slug', slugNormalizado)
    .maybeSingle();
  if (!data?.id) return null;
  if (estaArchivado(data.archived_at) && !(await puedeVerArchivados())) return null;
  return data.id as string;
}

/**
 * ¿Este cliente se ve desde la sesión que hay abierta?
 *
 * SIN PUERTA (2026-10-02): sin sesión, todos los clientes se ven. Con sesión,
 * solo el que corresponde a la cookie, porque el guard de escritura usa esa fila
 * y abrir de más sin fila sería pintar botones que la base va a rechazar.
 */
export function clienteEsVisible(slug: string, proyectoDeLaSesion: string | null | undefined): boolean {
  if (!proyectoDeLaSesion) return true;
  return proyectoDeLaSesion === slug;
}