// NX-1028 paso 3 — matriz de acceso del plan de publicación social.
//
// La misión la define así:
//
//   visitante (sin sesión)      → SIN ACCESO: ni leer ni escribir
//   client_viewer               → solo lectura
//   client_approver y owner     → aprobar o solicitar cambios
//   equipo y admin              → crear, editar, ordenar y programar
//   nadie                       → borrado irreversible (no existe tal permiso)
//
// Vive en UN archivo, igual que `flow.ts` para el flujo de ideas, porque el
// mismo fallo ya se pagó dos veces en este repo: la lista de la UI y la de la
// API se desincronizan y aparece el botón visible que responde 403. Aquí la
// página (cliente) y `/api/social-plan` (servidor) leen de la misma función.
//
// `admin` no es un RoleKey: la lista de `flow.ts` no lo contempla y este repo
// resuelve al admin como `owner` vía `esSuperAdmin()` dentro de
// `rolEnProyecto()` (project-guard.ts). Por eso el rol que llega a esta función
// ya es `owner` cuando quien llama es admin; no hace falta duplicar el caso.
//
// Módulo puro a propósito: ni `server-only` ni acceso a la base, para que las
// pruebas unitarias cubran toda la matriz sin red y sin cookies.
import { PUEDE_EDITAR, type RoleKey } from '@/lib/flow';

/**
 * El rol que llega, tal como llega: de la base o del navegador.
 *
 * Es `string` y no `RoleKey` a propósito — el valor viene de
 * `rr_hub_access.role_in_project` y de una cookie, y ambos pueden traer basura
 * (el repo ya pagó un `creative` con typo que no existía). Que sea string no
 * abre nada: `permisosSociales()` usa lista positiva y lo desconocido no pasa.
 * `'visitante'` es el rol de quien no abrió la puerta; `'sin_rol'`, el de una
 * sesión sin fila en ESTE proyecto. Ojo: `sin_rol` ya NO abre lectura por sí
 * solo (NX-1030 H1) — si la sesión no tiene fila, el plan es de otro cliente.
 * La única lectura que se concede sin fila es la del camino SIN TABLA, y esa
 * no vive en el rol: vive en `veredicto.via`, resuelta por
 * `permisosSocialesDeVeredicto()`.
 */
export type RolSocial = string | null | undefined;

export type PermisosSociales = {
  puedeLeer: boolean;
  /** Crear, editar, ordenar y programar. */
  puedeEditar: boolean;
  /** Aprobar o solicitar cambios. */
  puedeAprobar: boolean;
  /**
   * Existe y es `false` SIEMPRE. No hay permiso de borrado irreversible ni en
   * la UI ni en la API: lo único que retira una pieza del plan vivo es
   * `archivar()`, que es reversible (`SocialStore.archivar/restaurar`).
   * Se declara explícito para que el hecho de que nunca esté `true` sea
   * comprobable por prueba y no una suposición de quien lea el código.
   */
  puedeBorrar: false;
};

/** La matriz completa, en una sola tabla. Lo que no está aquí, no pasa. */
const MATRIZ: Record<string, Pick<PermisosSociales, 'puedeLeer' | 'puedeEditar' | 'puedeAprobar'>> = {
  visitante: { puedeLeer: false, puedeEditar: false, puedeAprobar: false },
  client_viewer: { puedeLeer: true, puedeEditar: false, puedeAprobar: false },
  client_approver: { puedeLeer: true, puedeEditar: false, puedeAprobar: true },
  owner: { puedeLeer: true, puedeEditar: true, puedeAprobar: true },
  // El equipo de la casa: creativa, cámara, modelo, editor, publisher y pauta.
  // Todos pueden crear, editar, ordenar y programar; ninguno aprueba por el
  // cliente — esa decisión es del cliente y de dirección.
  creator: { puedeLeer: true, puedeEditar: true, puedeAprobar: false },
  camera: { puedeLeer: true, puedeEditar: true, puedeAprobar: false },
  model: { puedeLeer: true, puedeEditar: true, puedeAprobar: false },
  editor: { puedeLeer: true, puedeEditar: true, puedeAprobar: false },
  publisher: { puedeLeer: true, puedeEditar: true, puedeAprobar: false },
  media_buyer: { puedeLeer: true, puedeEditar: true, puedeAprobar: false },
};

/**
 * ¿El rol que llega es uno que esta matriz conoce?
 *
 * Lista POSITIVA por el mismo motivo que `PUEDE_EDITAR`: una lista negativa
 * deja pasar por descarte cualquier valor desconocido que venga de la base.
 */
export function esRolSocialConocido(rol: RolSocial): boolean {
  return typeof rol === 'string' && Object.prototype.hasOwnProperty.call(MATRIZ, rol);
}

/**
 * La celda de «no pasa nada»: sin sesión, sin fila en este proyecto o sin
 * proyecto conocido. Exportada para que ruta y página no reescriban a mano
 * cuatro `false` (dos listas de permisos es el fallo que este repo ya pagó).
 */
export const SIN_ACCESO: PermisosSociales = {
  puedeLeer: false,
  puedeEditar: false,
  puedeAprobar: false,
  puedeBorrar: false,
};

/**
 * Los permisos que salen SOLO del rol, sin mirar de dónde vino.
 *
 * Sin sesión (o con un valor que no es un rol real) no hay permiso ninguno:
 * el visitante no lee, no escribe y no aprueba. Lista positiva: lo que no está
 * en `MATRIZ` cae en `SIN_ACCESO`, y eso incluye `sin_rol`.
 *
 * `sin_rol` deja de leer aquí (NX-1030 H1): era la lectura cruzada entre
 * clientes — cualquier cookie válida de un cliente leía el plan de otro
 * porque la ruta solo miraba el rol y el rol decía «sin fila, pero lee».
 * La lectura del camino demo no se perdió: se movió al veredicto, abajo.
 */
export function permisosSociales(rol: RolSocial): PermisosSociales {
  if (!esRolSocialConocido(rol)) return { ...SIN_ACCESO };
  const celda = MATRIZ[rol as string];
  return { ...celda, puedeBorrar: false };
}

/**
 * De dónde salió el veredicto, con las mismas tres etiquetas que devuelve
 * `rolEnProyecto()` (project-guard.ts). Se declara aquí de forma estructural,
 * y no se importa el tipo de allá, para que este módulo siga siendo puro:
 * sin `server-only`, sin base y cubierto entero por pruebas unitarias.
 *
 * · `session`    → había cookie Y se cruzó contra la tabla: el rol es real
 *                  para ESTE proyecto (fila hallada) o `sin_rol` (sin fila).
 * · `sin-sesion` → no había cookie: no se concede nada.
 * · `sin-tabla`  → no existía la tabla (modo demo o despliegue sin Supabase):
 *                  no hay datos que proteger, y ahí SÍ se lee.
 */
export type ViaVeredicto = 'session' | 'sin-sesion' | 'sin-tabla';

/** El veredicto completo de la puerta, tal como lo entrega el guard. */
export type VeredictoSocial = { rol: RolSocial; via: ViaVeredicto } | null;

/**
 * Los permisos del plan para ESTE proyecto, con la distinción que manda:
 *
 *   SIN TABLA (demo, sin datos)  → se permite leer, el camino de demo sigue
 *                                  midiendo lo que dice medir.
 *   SIN FILA con tabla presente  → 403: miembro inexistente en este cliente,
 *                                  una cookie de OTRO cliente no lee aquí.
 *
 * Es la puerta de `GET/PUT /api/social-plan` y de la página `/redes`, desde el
 * mismo archivo, para que UI y API cuenten la misma historia. `via: 'sin-sesion'`
 * se niega por si acaso: quien no trae cookie no lee nada, aunque el guard
 * haya degradado el rol a `client_viewer` para no romper el resto del hub.
 */
export function permisosSocialesDeVeredicto(veredicto: VeredictoSocial): PermisosSociales {
  if (!veredicto) return { ...SIN_ACCESO };
  if (veredicto.via === 'sin-sesion') return { ...SIN_ACCESO };
  const base = permisosSociales(veredicto.rol);
  if (veredicto.via === 'sin-tabla') {
    // Sin tabla no hay fila que mirar: el rol será `sin_rol` (o `owner` si el
    // correo está en SUPER_ADMIN_EMAILS) y la lectura se concede igual. Lo que
    // NO se concede es escritura ni aprobación por este atajo: esas siguen
    // necesitando un rol real de la matriz.
    return { ...base, puedeLeer: true };
  }
  return base;
}

/** Las dos colecciones del plan, tal como las manda el cliente. */
export type PlanParaChequeo = {
  posts: import('@/lib/social-planning').SocialPost[];
  pautas: import('@/lib/social-planning').SocialPost[];
};

/**
 * ¿Este plan nuevo solo cambia aprobaciones respecto del guardado?
 *
 * Es la puerta lateral que necesita `client_approver`: aprobar o pedir cambios
 * muta el plan (estado y comentario) y el autoguardado lo manda por el mismo
 * PUT que usa el equipo para editar. Sin esta función, o bien el cliente no
 * podía aprobar nada, o bien podía reescribir la publicación entera.
 *
 * La comprobación es estricta y se hace contra el plan GUARDADO, no contra lo
 * que diga el cliente:
 *   · misma cantidad de piezas y en el MISMO orden (así un aprobador no
 *     reordena ni programa),
 *   · los mismos ids,
 *   · solo `estado` y `feedbackCambio` pueden diferir; todo lo demás
 *     (contenido, portada, hashtags, fecha, color…) tiene que ser idéntico.
 */
export function soloCambioDeAprobacion(antes: PlanParaChequeo, despues: PlanParaChequeo): boolean {
  return (
    mismaColeccion(antes.posts, despues.posts) && mismaColeccion(antes.pautas, despues.pautas)
  );
}

function mismaColeccion(antes: import('@/lib/social-planning').SocialPost[], despues: import('@/lib/social-planning').SocialPost[]): boolean {
  if (!Array.isArray(antes) || !Array.isArray(despues)) return false;
  if (antes.length !== despues.length) return false;
  return antes.every((viejo, indice) => {
    const nuevo = despues[indice];
    if (!nuevo || nuevo.id !== viejo.id) return false;
    // Campos que un aprobador sí puede tocar.
    const { estado: _e, feedbackCambio: _f, ...intocablesViejo } = viejo;
    const { estado: _e2, feedbackCambio: _f2, ...intocablesNuevo } = nuevo;
    return JSON.stringify(intocablesViejo) === JSON.stringify(intocablesNuevo);
  });
}

/** Textos para la interfaz, en el mismo tono que ESTADO_GUARDADO_TEXTO. */
export const MOTIVO_SIN_PERMISO = {
  leer: 'Este plan es privado del proyecto: entra con tu código de cliente para verlo.',
  editar: 'Tu rol solo puede mirar este plan. Para crear, editar, ordenar o programar habla con el equipo.',
  aprobar: 'Tu rol solo puede aprobar o pedir cambios.',
  borrar: 'Aquí no se borra nada: las piezas se retiran archivando, y eso se puede deshacer.',
} as const;

/** El rol de `flow.ts` que se usa para escribir en el plan (mismo criterio). */
export const PUEDE_EDITAR_PLAN: readonly RoleKey[] = PUEDE_EDITAR;
