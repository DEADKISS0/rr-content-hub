// `server-only` on purpose: a guard that leaks into the browser is not a guard.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { AUTH_ENABLED } from '@/lib/mode';
import { PUEDE_EDITAR, type RoleKey } from '@/lib/flow';

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

/**
 * Roles que pueden crear y mover piezas. `client_viewer` no está.
 *
 * `creative` estaba aquí, pero NINGÚN rol real se llama así: la columna
 * `rr_hub_access.role_in_project` guarda `creator` (3 filas) — medido el
 * 2026-09-27. Con el typo, un creativo con el rol correcto caía en `sin_rol` y
 * no podía escribir nada. Los nombres tienen que ser los de `flow.ts`
 * (`ROLE_KEYS`), no otros parecidos: ese archivo es la autoridad, y
 * `project-guard.test.ts` falla si se desincronizan.
 */
/**
 * Los permisos viven en UN archivo, y en el mismo sitio para los dos lados.
 *
 * Antes había dos listas que se desincronizaron: la del guard (lo que la
 * interfaz muestra) y la de la API (lo que el servidor acepta). Con mi cambio
 * quedaron cuatro, y el síntoma fue justo el que el repo ya había pagado dos
 * veces: el botón visible que al pulsarlo responde 403. Un `publisher` veía
 * "GUARDAR" y no podía; un `model` podía editar y no le salía nada.
 *
 * La regla: quien decide qué puede hacer un rol es `PUEDE_*` en `flow.ts`, y
 * tanto el guard como la API leen de ahí. Si hay que cambiar un permiso, se
 * cambia en un sitio y los dos lados cuentan la misma historia.
 */
export const PUEDE_ESCRIBIR: readonly RoleKey[] = PUEDE_EDITAR;
/** Aprobar no es lo mismo que crear: quien aprueba no reescribe la pieza. */
const PUEDE_APROBAR: readonly RoleKey[] = ['owner', 'client_approver'];

export type RolProyecto =
  | 'owner' | 'creator' | 'editor' | 'client_approver'
  | 'client_viewer' | 'camera' | 'model' | 'publisher' | 'media_buyer' | 'sin_rol';

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

  // Sin sesión. El hub está en modo abierto (el login de Google pelea con
  // Medellín Guide) y el servidor de escritura opera con rol `owner` en esa
  // MISMA situación — ver `ABIERTO` en `api/workspace/[action]/route.ts`. Si
  // aquí devolviera lectura, la interfaz escondería los botones de transición
  // que el servidor sí aceptaría: el bug exacto de "no tiene transiciones".
  // La puerta y el rol tienen que contarse la misma historia.
  //
  // Nunca devolver `sin_rol`: no existe en `flow.ts` (`ROLE_KEYS`), así que
  // `allowedTransitions` la degradaría igual a lectura, y el perfil lo mostraría
  // como un rol roto en vez de como lo que es — nadie dentro.
  if (!email) {
    const abierto = !AUTH_ENABLED;
    return {
      rol: abierto ? 'owner' : 'client_viewer',
      email: null,
      puedeEscribir: abierto,
      puedeAprobar: abierto,
      via: 'sin-sesion',
    };
  }

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
  // `sin_rol` es lo que devuelve el guard cuando la fila no trae un rol válido.
  // No es un rol de `ROLE_KEYS`, así que ni `includes` ni el `Set` lo aceptan;
  // se resuelve comprobando los roles reales. No hay que "arreglar" el rol:
  // nadie está en el equipo si su fila no dice un rol que existe.
  const esRolReal = (valor: RolProyecto): valor is RoleKey =>
    (PUEDE_EDITAR as readonly string[]).includes(valor);
  return {
    rol,
    email,
    puedeEscribir: esRolReal(rol) && PUEDE_EDITAR.includes(rol),
    puedeAprobar: esRolReal(rol) && PUEDE_APROBAR.includes(rol),
    via: 'session',
  };
}
