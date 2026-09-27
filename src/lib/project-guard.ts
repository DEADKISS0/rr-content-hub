// `server-only` on purpose: a guard that leaks into the browser is not a guard.
import 'server-only';
import { createClient } from '@/lib/supabase/server';

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

/** Roles que pueden crear y mover piezas. `client_viewer` no está. */
const PUEDE_ESCRIBIR = new Set(['owner', 'creative', 'client_approver', 'client_editor', 'editor']);
/** Roles que pueden aprobar o rechazar. Aprobar no es lo mismo que crear. */
const PUEDE_APROBAR = new Set(['owner', 'client_approver']);

export type RolProyecto =
  | 'owner' | 'creative' | 'editor' | 'client_approver' | 'client_editor'
  | 'client_viewer' | 'camera' | 'media_buyer' | 'sin_rol';

export type VeredictoProyecto = {
  rol: RolProyecto;
  email: string | null;
  puedeEscribir: boolean;
  puedeAprobar: boolean;
  via: 'session' | 'sin-sesion' | 'sin-tabla';
};

/**
 * El rol de esta persona en ESTE proyecto.
 *
 * Por qué existía el `role="owner"` hardcodeado en el layout: nadie lo había
 * cableado. El resultado era que un `client_viewer` veía el mismo botón de
 * crear que la dirección y, al pulsarlo, recibía un 401 — la interfaz prometía
 * algo que el servidor no iba a dejar hacer. Aquí se resuelve en el servidor,
 * que es el único sitio donde la respuesta es de fiar.
 */
export async function rolEnProyecto(projectId: string): Promise<VeredictoProyecto> {
  const supabase = await createClient();
  if (!supabase) return { rol: 'sin_rol', email: null, puedeEscribir: false, puedeAprobar: false, via: 'sin-tabla' };

  const { data: usuario } = await supabase.auth.getUser();
  const email = usuario.user?.email?.toLowerCase() ?? null;
  if (!email) return { rol: 'sin_rol', email: null, puedeEscribir: false, puedeAprobar: false, via: 'sin-sesion' };

  // La lista de emergencia: mientras la tabla esté incompleta, el equipo
  // directive conserva el acceso. No reemplaza la tabla; solo la red de seguridad.
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return { rol: 'owner', email, puedeEscribir: true, puedeAprobar: true, via: 'session' };
  }

  const { data } = await supabase
    .from('rr_hub_access')
    .select('role_in_project')
    .eq('user_id', usuario.user!.id)
    .eq('project_id', projectId)
    .maybeSingle();

  const rol = (data?.role_in_project as RolProyecto | undefined) ?? 'sin_rol';
  return {
    rol,
    email,
    puedeEscribir: PUEDE_ESCRIBIR.has(rol),
    puedeAprobar: PUEDE_APROBAR.has(rol),
    via: 'session',
  };
}
