// `server-only` on purpose: a guard that leaks into the browser is not a guard.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { quienEs } from '@/lib/quien-es';
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
  // Con la clave del servidor, no con la `anon`. Sin sesión de Supabase el RLS
  // no tiene contra qué comparar `auth.uid()`, y la consulta del rol volvía
  // vacía para todo el mundo: la puerta abría y el tablero salía en solo
  // lectura, sin error visible. Aquí la identidad la trae la cookie firmada, que
  // se resuelve arriba; lo que la base hace es devolver la fila.
  const supabase = (await createServiceClient()) ?? (await createClient());
  if (!supabase) return { rol: 'sin_rol', email: null, puedeEscribir: false, puedeAprobar: false, via: 'sin-tabla' };

  // La puerta es un código por cliente (2026-09-28), así que la identidad viene
  // de la cookie firmada del hub y no de `supabase.auth.getUser()`. El correo es
  // la llave: con la sesión se buscaba por `auth.uid()`, y ese id ya no existe
  // como identidad, aunque siga siendo la PK de `rr_hub_profiles`.
  const sesion = await quienEs();
  const email = sesion?.email ?? null;

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
    // Misma regla que la API (`resolverRol`): sin sesión no hay rol propio. El rol
    // de quien eligió un perfil en el selector lo resuelve `/api/workspace/mi-rol`.
    return { rol: 'client_viewer', email: null, puedeEscribir: false, puedeAprobar: false, via: 'sin-sesion' };
  }

  // La lista de emergencia: mientras la tabla esté incompleta, el equipo
  // directive conserva el acceso. No reemplaza la tabla; solo la red de seguridad.
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return { rol: 'owner', email, puedeEscribir: true, puedeAprobar: true, via: 'session' };
  }

  // Se cruza por correo, y el cruce se hace AQUÍ, en memoria, con dos
  // consultas planas.
  //
  // Por qué no un embed: `rr_hub_access.user_id` tiene su FK a `auth.users`, y
  // `rr_hub_profiles.id` es su propia PK. **Entre las dos tablas no hay ninguna
  // llave foránea** (medido el 2026-09-29 en `pg_constraint`: solo existe
  // `rr_hub_access_user_id_fkey → users`). PostgREST responde
  // `400 PGRST200 "no foreign key relationship between 'rr_hub_access' and
  // 'rr_hub_profiles'"` y devuelve `data: null` **con** error, sin excepción.
  //
  // El código solo leía `data?.role_in_project`, así que el PGRST200 pasaba
  // desapercibido y TODO el equipo caía en `sin_rol`. Como `sin_rol` no está en
  // `ROLE_KEYS`, `allowedTransitions` lo degradaba a lectura y `IdeaActions`
  // escondía los botones — mientras el servidor sí aceptaba la transición. La
  // puerta abierta y 15 piezas de Wundeer en `internal_review` Mostrando
  // "SIN ACCIÓN DISPONIBLE" solo para el super-admin.
  //
  // Es el mismo fallo que ya tenía `roster()` en la API, y por el mismo motivo:
  // **dos tablas sin relación no se pueden embedir.** Se cruzan en memoria.
  const [acceso, perfiles] = await Promise.all([
    supabase.from('rr_hub_access').select('user_id, role_in_project').eq('project_id', projectId),
    supabase.from('rr_hub_profiles').select('id, email'),
  ]);

  const porCorreo = new Map<string, string>();
  for (const fila of (perfiles.data ?? []) as { id: string; email: string }[]) {
    if (fila.email) porCorreo.set(fila.email.toLowerCase(), fila.id);
  }
  const idDeEsta = porCorreo.get(email.toLowerCase());
  const filaDeEsta = (acceso.data ?? []).find(
    (fila) => fila.user_id === idDeEsta,
  ) as { role_in_project: RolProyecto } | undefined;

  const rol = filaDeEsta?.role_in_project ?? 'sin_rol';
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
