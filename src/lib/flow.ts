/**
 * Single source of truth for the RR Content Hub workflow.
 *
 * Every surface (server pages, client widgets, queues) reads from here, so a
 * status change or a new role rule is defined once. The UI never invents an
 * action: it asks `allowedTransitions()` what the current role may do.
 */

export type WorkflowStatus =
  | 'draft' | 'internal_review' | 'voting' | 'pending_approval' | 'needs_changes' | 'approved'
  | 'script_in_progress' | 'pending_script_review' | 'script_approved'
  | 'in_production' | 'raw_uploaded' | 'editing' | 'ready_to_publish'
  | 'published' | 'closed';

export type RoleKey =
  | 'owner' | 'creator' | 'camera' | 'model' | 'editor'
  | 'publisher' | 'media_buyer' | 'client_approver' | 'client_viewer';

/** Runtime guard for a role that arrived from the database or the browser. */
export const ROLE_KEYS: readonly RoleKey[] = [
  'owner', 'creator', 'camera', 'model', 'editor',
  'publisher', 'media_buyer', 'client_approver', 'client_viewer',
] as const;

/**
 * Quién puede tocar qué.
 *
 * Esto vive en UN solo archivo a propósito. Antes había tres listas distintas
 * de "quién escribe": la de las transiciones, la del guard, y la de la API, que
 * era una lista NEGATIVA (bloquear a `client_viewer` y dejar pasar todo lo
 * demás). Con esa, `client_approver` —el rol del cliente, cuya función es
 * aprobar— podía reescribir el guion y cambiar las referencias de una pieza.
 *
 * La lista negativa es el problema: cualquier rol nuevo, o un valor con una
 * errata en la base, entra por descarte. Aquí la lista es positiva: lo que no
 * está aquí, no escribe.
 */
export const PUEDE_EDITAR: readonly RoleKey[] = ['owner', 'creator', 'camera', 'model', 'editor'] as const;
/** El guion es de quien produce, no de quien aprueba ni de quien solo mira. */
export const PUEDE_ESCRIBIR_GUION: readonly RoleKey[] = ['owner', 'creator', 'editor'] as const;
/** Comentar es de cualquiera del equipo: es la vía para pedir un cambio. */
export const PUEDE_COMENTAR: readonly RoleKey[] = [
  'owner', 'creator', 'camera', 'model', 'editor', 'publisher', 'media_buyer',
  'client_approver', 'client_viewer',
] as const;

export const STATUS_ORDER: WorkflowStatus[] = [
  'draft', 'internal_review', 'voting', 'pending_approval', 'needs_changes', 'approved',
  'script_in_progress', 'pending_script_review', 'script_approved',
  'in_production', 'raw_uploaded', 'editing', 'ready_to_publish',
  'published', 'closed',
];

/** Five macro phases give a person one glance instead of thirteen labels. */
export const PHASES = [
  { key: 'idea', label: 'IDEA', detail: 'Se propone, se revisa y se decide', statuses: ['draft', 'internal_review', 'voting', 'pending_approval', 'needs_changes'] },
  { key: 'script', label: 'GUIÓN', detail: 'Se escribe y se aprueba', statuses: ['approved', 'script_in_progress', 'pending_script_review', 'script_approved'] },
  { key: 'shoot', label: 'RODAJE', detail: 'Se graba y se sube el crudo', statuses: ['in_production', 'raw_uploaded'] },
  { key: 'edit', label: 'EDICIÓN', detail: 'Se monta y se aprueba', statuses: ['editing', 'ready_to_publish'] },
  { key: 'live', label: 'PUBLICACIÓN', detail: 'Se publica y se cierra', statuses: ['published', 'closed'] },
] as const;

export function phaseIndex(status: WorkflowStatus): number {
  const index = PHASES.findIndex((phase) => (phase.statuses as readonly string[]).includes(status));
  return index === -1 ? 0 : index;
}

export const STATUS_LABEL: Record<WorkflowStatus, string> = {
  draft: 'BORRADOR', internal_review: 'REVISIÓN INTERNA', voting: 'EN VOTACIÓN',
  pending_approval: 'ESPERANDO AL CLIENTE', needs_changes: 'AJUSTES SOLICITADOS',
  approved: 'IDEA APROBADA', script_in_progress: 'GUIÓN EN CONSTRUCCIÓN', pending_script_review: 'GUIÓN POR APROBAR',
  script_approved: 'GUIÓN APROBADO', in_production: 'RODAJE EN CURSO', raw_uploaded: 'CRUDO CARGADO',
  editing: 'EN EDICIÓN', ready_to_publish: 'REVISIÓN FINAL', published: 'PUBLICADO', closed: 'CERRADO',
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  owner: 'OWNER', creator: 'CREATIVA', camera: 'CÁMARA', model: 'MODELO', editor: 'EDITOR',
  publisher: 'PUBLISHER', media_buyer: 'PAUTA', client_approver: 'CLIENTE', client_viewer: 'CLIENTE (LECTURA)',
};

type Transition = { to: WorkflowStatus; label: string; note: string; roles: 'team' | 'client' | 'all'; owners?: RoleKey[] };

/** A status offers few, explicit moves. Roles decide which ones you actually see. */
const TRANSITIONS: Partial<Record<WorkflowStatus, Transition[]>> = {
  draft: [
    // Antes `draft` saltaba directo a `pending_approval`: la idea se creaba y de
    // una vez viajaba al cliente, sin que nadie del equipo la mirara. Ahora
    // `draft` significa "idea nueva, todavía sin revisar" y el paso obligatorio es
    // `internal_review`. Es el cambio que pidió Santiago el 2026-09-28: la idea
    // se revisa y se vota DENTRO de la casa antes de hablar con el cliente.
    { to: 'internal_review', label: 'MIRAR EN REVISIÓN INTERNA', note: 'La idea entra a revisión interna del equipo.', roles: 'team' },
  ],
  internal_review: [
    { to: 'voting', label: 'ABRIR VOTACIÓN', note: 'El equipo vota la idea antes de mandarla al cliente.', roles: 'team', owners: ['owner', 'creator', 'media_buyer'] },
    // Atajo para cuando nadie quiere voting: se aprueba por decisión del equipo.
    { to: 'pending_approval', label: 'IR DIRECTO AL CLIENTE', note: 'Revisión interna superada sin votación; va al cliente.', roles: 'team', owners: ['owner', 'creator', 'media_buyer'] },
  ],
  voting: [
    // La salida normal de `voting` NO es una transición que pulse una persona: la
    // calcula el servidor al Contar votos (mayoría simple). Estas dos son el
    // cierre manual, para cuando la votación se queda quieta o se quiere parar.
    { to: 'pending_approval', label: 'CERRAR VOTACIÓN Y MANDAR', note: 'Votación cerrada; la idea va al cliente.', roles: 'team', owners: ['owner', 'creator', 'media_buyer'] },
    { to: 'internal_review', label: 'ABRIR DE NUEVO LA REVISIÓN', note: 'Votación detenida; la idea vuelve a revisión interna.', roles: 'team', owners: ['owner', 'creator', 'media_buyer'] },
  ],
  pending_approval: [
    { to: 'approved', label: 'APROBAR IDEA', note: 'El cliente aprobó la idea.', roles: 'client' },
    { to: 'needs_changes', label: 'SOLICITAR AJUSTES', note: 'El cliente pidió ajustes antes de continuar.', roles: 'client' },
    { to: 'closed', label: 'ARCHIVAR PROPUESTA', note: 'El cliente archivó esta propuesta.', roles: 'client' },
  ],
  needs_changes: [
    { to: 'pending_approval', label: 'REENVIAR AL CLIENTE', note: 'Propuesta ajustada y reenviada.', roles: 'team' },
  ],
  approved: [
    { to: 'script_in_progress', label: 'INICIAR GUIÓN', note: 'Idea aprobada; arranca la escritura del guion.', roles: 'team' },
  ],
  script_in_progress: [
    { to: 'pending_script_review', label: 'ENVIAR GUIÓN AL CLIENTE', note: 'Guion enviado para validación.', roles: 'team' },
  ],
  pending_script_review: [
    { to: 'script_approved', label: 'APROBAR GUIÓN', note: 'El cliente aprobó el guion.', roles: 'client' },
    // This used to go to `needs_changes`, which lives in the IDEA phase: asking
    // for a script change sent the piece back two phases and forced the client
    // to re-approve the idea itself. Script revisions now return to the script.
    { to: 'script_in_progress', label: 'PEDIR CAMBIOS AL GUIÓN', note: 'El cliente pidió cambios en el guion; vuelve a escribirse.', roles: 'client' },
  ],
  script_approved: [
    { to: 'in_production', label: 'INICIAR RODAJE', note: 'Producción confirmada; arranca el rodaje.', roles: 'team' },
  ],
  in_production: [
    { to: 'raw_uploaded', label: 'MARCAR CRUDO CARGADO', note: 'Material crudo cargado y listo para edición.', roles: 'team' },
  ],
  raw_uploaded: [
    { to: 'editing', label: 'INICIAR EDICIÓN', note: 'Edición iniciada sobre el crudo.', roles: 'team' },
  ],
  editing: [
    { to: 'ready_to_publish', label: 'MARCAR EDICIÓN LISTA', note: 'Corte listo para revisión final.', roles: 'team' },
  ],
  ready_to_publish: [
    // Was `roles: 'all'`, which let anyone publish — including a visitor with
    // the read-only `client_viewer` role. The owner escape hatch below still
    // lets the owner step in, so nothing is lost.
    { to: 'published', label: 'APROBAR Y PUBLICAR', note: 'Revisión final aprobada; pieza publicada.', roles: 'team', owners: ['owner', 'publisher', 'media_buyer'] },
  ],
  published: [
    // `closed` is terminal and owns nobody, so without naming owners here the
    // only way to ever close a piece was the owner escape hatch.
    { to: 'closed', label: 'CERRAR FLUJO', note: 'Pieza cerrada conservando todo su historial.', roles: 'team', owners: ['owner', 'publisher', 'media_buyer'] },
  ],
};

/**
 * Only these roles may move a piece forward from each status. This is the
 * single authority: `waitingOn`, `STATUS_META.who` and the queue filters all
 * derive from it, and the verification script reads it directly so a change
 * here cannot pass unnoticed.
 */
export const STATUS_OWNERS: Record<WorkflowStatus, RoleKey[]> = {
  draft: ['owner', 'creator'],
  // Los dos estados nuevos son del equipo, nunca del cliente: la idea todavía
  // no ha salido de la casa. `media_buyer` está porque las ideas de pauta las
  // vota quien las va a pautar, no solo la creativa.
  internal_review: ['owner', 'creator', 'media_buyer'],
  voting: ['owner', 'creator', 'media_buyer'],
  pending_approval: [], needs_changes: ['owner', 'creator'],
  approved: ['owner', 'creator'], script_in_progress: ['owner', 'creator', 'editor'],
  pending_script_review: [], script_approved: ['owner', 'camera', 'model'],
  in_production: ['camera', 'model', 'owner'], raw_uploaded: ['editor', 'owner'],
  editing: ['editor', 'owner'], ready_to_publish: ['owner', 'publisher', 'media_buyer'],
  published: ['publisher', 'media_buyer', 'owner'], closed: [],
};

export type AllowedTransition = { to: WorkflowStatus; label: string; note: string };

/**
 * Raw transition table, exported for the verification script. Reading the
 * engine's own source of truth is the only way to assert "no state is stranded"
 * without duplicating the rules in the test — which is how tests drift.
 */
export const TRANSITIONS_FOR_TEST = TRANSITIONS;

/**
 * The rows a person can actually click. An owner may always step in; everyone
 * else sees only their own hand-off. Empty means "you are waiting on someone".
 */
export function allowedTransitions(role: RoleKey, status: WorkflowStatus): AllowedTransition[] {
  const options = TRANSITIONS[status] ?? [];
  if (!options.length) return [];
  const isOwner = role === 'owner';
  return options
    .filter((option) => {
      if (option.roles === 'all') return true;
      if (isOwner) return true;
      if (option.roles === 'client') return role === 'client_approver';
      // A transition may name its own owners; otherwise it falls back to the
      // owners of the state being left. Using the *source* state alone made
      // `published → closed` unreachable: `closed` has no owners, so only the
      // owner escape hatch could ever fire it.
      return (option.owners ?? STATUS_OWNERS[status]).includes(role);
    })
    .map(({ to, label, note }) => ({ to, label, note }));
}

/**
 * ¿La votación se ganó y esta idea tiene que salir al cliente?
 *
 * Santiago eligió mayoría simple el 2026-09-28: sale si hay más votos a favor
 * que en contra. La regla vive AQUÍ y no en la acción `vote` por dos razones:
 *
 * 1. Es dominio, y el dominio vive en este archivo. Si el criterio de "ganó"
 *    estuviera en la API, habría que leer la API para saber cuándo una idea
 *    avanza, y la regla no sería verificable por `verify-flow`.
 * 2. Un empate NO aprueba: sin decir esto explícitamente, `aFavor > enContra` con
 *    1 contra y 1 a favor deja la decisión en manos de quién llegara después.
 */
export function ganoLaVotacion(aFavor: number, enContra: number): boolean {
  return aFavor > enContra;
}
/**
 * El estado al que salta una idea cuando su votación se gana.
 *
 * Sale de la tabla de transiciones (`voting -> pending_approval`), no de una
 * constante escrita aquí. Si mañana la salida de `voting` cambia, esta función
 * lo sigue sin que nadie la tenga que editar: la votación no debería conocer el
 * nombre del estado al que lleva, solo que hay uno.
 */
export function salidaDeLaVotacion(): WorkflowStatus | null {
  return TRANSITIONS.voting?.find((m) => m.to !== 'internal_review')?.to ?? null;
}

/**
 * Who the piece is waiting for right now.
 *
 * This used to special-case the two client-waiting states with a hardcoded
 * string, while `STATUS_OWNERS` kept an empty array for them — two sources of
 * truth for the same question. The client states now name their owners, and
 * the label comes from ROLE_HOME-style copy in ROLE_LABEL.
 */
const CLIENT_GATED: readonly WorkflowStatus[] = ['pending_approval', 'pending_script_review'];

/**
 * ¿La pieza está esperando a alguien de fuera?
 *
 * Esta pregunta se hacía de tres maneras distintas en el código y las tres
 * daban números diferentes: la cola de aprobaciones (que incluye
 * `needs_changes`, donde el cliente ya respondió y le toca al equipo), la
 * comparación a mano con `'el cliente'`, y ahora `ESPERA_CLIENTE` en el tablero.
 * Todas desde fuentes distintas, y por eso el tablero decía 6 esperando al
 * cliente cuando eran 3.
 *
 * La respuesta vive aquí, junto a `waitingOn`, que ya usaba esta misma lista.
 * Cualquier pantalla que necesite contarlas sale de `esEsperaDelCliente()`.
 */
export function esEsperaDelCliente(status: string): boolean {
  return CLIENT_GATED.includes(status as WorkflowStatus);
}

/**
 * ¿La pieza ya no requiere que nadie la empuje?
 *
 * `published` y `closed` son los dos estados terminales del flujo. Un tablero que
 * los cuenta como "pendientes" infla el número de trabajo que hay: con 26
 * piezas, una ya cerrada sonaba a que aún pedía atención.
 */
export function esTerminal(status: string): boolean {
  return status === 'published' || status === 'closed';
}

export function waitingOn(status: WorkflowStatus): string {
  if (status === 'closed') return 'nadie: flujo cerrado';
  if (CLIENT_GATED.includes(status)) return 'el cliente';
  const owners = STATUS_OWNERS[status];
  if (!owners.length) return 'nadie por ahora';
  return owners.map((role) => ROLE_LABEL[role]).join(' o ');
}

/**
 * The single move the engine would offer a team member from this state.
 *
 * Used to return `options[0].to`, which is just the first row of the table —
 * for `pending_approval` that is `approved`, the most optimistic branch, which
 * is not a prediction of anything. Now it returns the team's move, ignoring
 * client-only branches, and `null` when only the client can act.
 */
export function nextStatus(status: WorkflowStatus): WorkflowStatus | null {
  const options = TRANSITIONS[status] ?? [];
  const teamMove = options.find((o) => o.roles === 'team' || o.roles === 'all');
  if (teamMove) return teamMove.to;
  return options.length ? options[0].to : null;
}

/* ───────────────────────────────────────────────────────────────────────────
 * PRESENTACIÓN POR ESTADO
 *
 * Cada estado se comunica con CUATRO señales a la vez (ícono + color + texto +
 * responsable) para que nadie dependa solo del color: si alguien no distingue
 * mostaza de fucsia, el ícono y el texto siguen contando la historia.
 *
 * Tonos B.U.C.M. — un tono = un significado, sin excepciones:
 *   mostaza  → la pelota está en el CLIENTE (decisión pendiente de fuera)
 *   fucsia   → está en PRODUCCIÓN (rodaje, edición, salida)
 *   orquidea → el EQUIPO tiene que actuar (escritura, montaje, revisión interna)
 *   neutro   → borrador, publicado o cerrado (sin acción pendiente)
 * ─────────────────────────────────────────────────────────────────────────── */
export type ToneKey = 'neutro' | 'mostaza' | 'fucsia' | 'orquidea';

export type StatusMeta = { label: string; icon: string; tone: ToneKey; who: string; blurb: string };

export const STATUS_META: Record<WorkflowStatus, StatusMeta> = {
  draft: { label: 'BORRADOR', icon: '✎', tone: 'neutro', who: 'CREATIVA', blurb: 'Idea nueva; todavía nadie del equipo la ha mirado.' },
  internal_review: { label: 'REVISIÓN INTERNA', icon: '◍', tone: 'orquidea', who: 'EQUIPO', blurb: 'El equipo la está mirando. Todavía no sale de la casa.' },
  voting: { label: 'EN VOTACIÓN', icon: '⚖', tone: 'orquidea', who: 'EQUIPO', blurb: 'Votación abierta: sale al cliente si hay más votos a favor que en contra.' },
  pending_approval: { label: 'ESPERA CLIENTE', icon: '⏱', tone: 'mostaza', who: 'CLIENTE', blurb: 'La propuesta está en manos del cliente para su decisión.' },
  needs_changes: { label: 'AJUSTES PEDIDOS', icon: '↺', tone: 'fucsia', who: 'CREATIVA', blurb: 'El cliente pidió cambios; la pelota vuelve al equipo.' },
  approved: { label: 'IDEA APROBADA', icon: '✓', tone: 'orquidea', who: 'CREATIVA', blurb: 'Dirección aprobada. Arranca la escritura del guion.' },
  script_in_progress: { label: 'GUIÓN EN CURSO', icon: '✍', tone: 'orquidea', who: 'CREATIVA', blurb: 'Se está escribiendo el guion de la pieza.' },
  pending_script_review: { label: 'GUIÓN POR APROBAR', icon: '⏱', tone: 'mostaza', who: 'CLIENTE', blurb: 'El guion espera la validación del cliente.' },
  script_approved: { label: 'GUIÓN APROBADO', icon: '✓', tone: 'fucsia', who: 'CÁMARA', blurb: 'Listo para rodar. El equipo de cámara ya tiene su brief.' },
  in_production: { label: 'GRABANDO', icon: '🎬', tone: 'fucsia', who: 'CÁMARA', blurb: 'Rodaje en curso; el crudo todavía no está cargado.' },
  raw_uploaded: { label: 'CRUDO SUBIDO', icon: '⬆', tone: 'orquidea', who: 'EDITOR', blurb: 'El material crudo está cargado y listo para montaje.' },
  editing: { label: 'EDITANDO', icon: '✏', tone: 'fucsia', who: 'EDITOR', blurb: 'Montaje en curso sobre el crudo.' },
  ready_to_publish: { label: 'REVISIÓN FINAL', icon: '◎', tone: 'orquidea', who: 'OWNER · PUBLISHER', blurb: 'Corte listo; falta la última aprobación antes de salir.' },
  published: { label: 'PUBLICADO', icon: '✓✓', tone: 'neutro', who: 'PUBLISHER', blurb: 'La pieza ya salió con su evidencia registrada.' },
  closed: { label: 'CERRADO', icon: '⊗', tone: 'neutro', who: '—', blurb: 'Flujo terminado; se conserva todo el historial.' },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as WorkflowStatus] ?? { label: status, icon: '•', tone: 'neutro', who: 'RR ALIADOS', blurb: '' };
}

/** Groups the 13 states into the five hand-offs a person actually filters by.
 *  La línea desplegada las había borrado por «código muerto»: lo eran allí, pero
 *  el tablero y su filtro de responsable las usan. Al fusionar, vuelven. */
export type ActGroup = 'cliente' | 'camara' | 'editor' | 'publisher' | 'equipo';

export const ACT_GROUPS: { key: ActGroup; label: string }[] = [
  { key: 'cliente', label: 'CLIENTE' },
  { key: 'camara', label: 'CÁMARA' },
  { key: 'editor', label: 'EDITOR' },
  { key: 'publisher', label: 'PUBLISHER' },
  { key: 'equipo', label: 'EQUIPO' },
];

export function actGroup(status: WorkflowStatus): ActGroup {
  if (status === 'pending_approval' || status === 'pending_script_review') return 'cliente';
  if (status === 'script_approved' || status === 'in_production') return 'camara';
  if (status === 'raw_uploaded' || status === 'editing') return 'editor';
  if (status === 'ready_to_publish' || status === 'published' || status === 'closed') return 'publisher';
  return 'equipo';
}

/** Clases por tono, reutilizadas por badges, rieles y filtros.
 *  El fondo SIEMPRE va neutro (`bg-blanco-05`): el color vive en el borde, el
 *  texto y el punto, nunca en un relleno grande. Motivo, medido el 2026-09-26:
 *  con relleno, 14 estados en pantalla se leian como un codigo de barras; con
 *  acento, el color vuelve a ser senal y la pantalla vuelve a respirar. */

/** El mismo tono en HEX, para lo que no admite clases (style inline, SVG).
 *  Las dos listas tienen que moverse juntas: si TONE_CLASS cambia de color y
 *  esta no, la barra y el badge cuentan cosas distintas. */
export const TONE_HEX: Record<ToneKey, string> = {
  mostaza: '#ded116',
  fucsia: '#be076d',
  orquidea: '#973d8f',
  neutro: '#6a6a64',
};

export const TONE_CLASS: Record<ToneKey, { border: string; borderLeft: string; bg: string; text: string; dot: string }> = {
  mostaza: { border: 'border-mostaza/50', borderLeft: 'border-l-mostaza/70 hover:border-l-mostaza', bg: 'bg-blanco-05', text: 'text-mostaza', dot: 'bg-mostaza' },
  fucsia: { border: 'border-fucsia/50', borderLeft: 'border-l-fucsia/70 hover:border-l-fucsia', bg: 'bg-blanco-05', text: 'text-fucsia', dot: 'bg-fucsia' },
  orquidea: { border: 'border-orquidea/50', borderLeft: 'border-l-orquidea/70 hover:border-l-orquidea', bg: 'bg-blanco-05', text: 'text-orquidea', dot: 'bg-orquidea' },
  neutro: { border: 'border-blanco-20', borderLeft: 'border-l-blanco-30 hover:border-l-blanco-60', bg: 'bg-blanco-05', text: 'text-blanco-60', dot: 'bg-blanco-40' },
};

/** The four visible steps of production, from approved script to ready-to-publish. */
export const PRODUCTION_STEPS = [
  { key: 'shoot', label: 'GRABACIÓN', detail: 'Equipo en set', statuses: ['script_approved', 'in_production'] },
  { key: 'raw', label: 'CRUDO SUBIDO', detail: 'Cámara subió archivos', statuses: ['raw_uploaded'] },
  { key: 'edit', label: 'EDICIÓN', detail: 'Editor montando', statuses: ['editing'] },
  { key: 'ready', label: 'LISTO', detail: 'Listo para publicar', statuses: ['ready_to_publish'] },
] as const;

/** Index of the active production step, or -1 when the piece is not in production. */
export function productionStep(status: WorkflowStatus): number {
  return PRODUCTION_STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status));
}

/** One-word status, for dense board cards. */
export const STATUS_SHORT: Record<WorkflowStatus, string> = {
  draft: 'Borrador', internal_review: 'Revisión interna', voting: 'En votación',
  pending_approval: 'Espera cliente', needs_changes: 'Ajustes',
  approved: 'Aprobada', script_in_progress: 'Escribiendo guion', pending_script_review: 'Guion por aprobar',
  script_approved: 'Guion listo', in_production: 'Grabando', raw_uploaded: 'Crudo subido',
  editing: 'Editando', ready_to_publish: 'Revisión final', published: 'Publicado', closed: 'Cerrado',
};

export function statusShort(status: string): string {
  return STATUS_SHORT[status as WorkflowStatus] ?? status;
}

/**
 * `BOARD_COLUMNS` y `boardColumn()` se fueron de aquí el 2026-09-28.
 *
 * Este archivo tenía SU PROPIA copia de las cuatro columnas del tablero, con los
 * estados escritos a mano, mientras `queues.ts` tenía la copia buena: la que
 * deriva de `PHASES`. Dos copias, y la de `flow.ts` no se enteró de que
 * `internal_review` y `voting` entraban en la fase IDEA — por eso los dos tests
 * de columna fallaron al añadir los estados nuevos.
 *
 * Es exactamente el fallo que este repo ya documentó dos veces: una lista de
 * estados escrita a mano se desincroniza de la fuente y nadie lo nota. Ahora hay
 * una sola: `queues.ts`, que a su vez sale de `PHASES`. Quien necesite las
 * columnas del tablero, las importa de `queues.ts`.

/**
 * Días desde la última actividad de una pieza. Vive aquí (y no dentro de un
 * componente) porque React 19 marca `Date.now()` en el render de un componente
 * como impuro; calculado en el módulo de flujo es una función normal.
 */
export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}
