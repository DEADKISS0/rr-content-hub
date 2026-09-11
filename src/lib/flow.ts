/**
 * Single source of truth for the RR Content Hub workflow.
 *
 * Every surface (server pages, client widgets, queues) reads from here, so a
 * status change or a new role rule is defined once. The UI never invents an
 * action: it asks `allowedTransitions()` what the current role may do.
 */

export type WorkflowStatus =
  | 'draft' | 'pending_approval' | 'needs_changes' | 'approved'
  | 'script_in_progress' | 'pending_script_review' | 'script_approved'
  | 'in_production' | 'raw_uploaded' | 'editing' | 'ready_to_publish'
  | 'published' | 'closed';

export type RoleKey =
  | 'owner' | 'creator' | 'camera' | 'model' | 'editor'
  | 'publisher' | 'media_buyer' | 'client_approver' | 'client_viewer';

export const STATUS_ORDER: WorkflowStatus[] = [
  'draft', 'pending_approval', 'needs_changes', 'approved',
  'script_in_progress', 'pending_script_review', 'script_approved',
  'in_production', 'raw_uploaded', 'editing', 'ready_to_publish',
  'published', 'closed',
];

/** Five macro phases give a person one glance instead of thirteen labels. */
export const PHASES = [
  { key: 'idea', label: 'IDEA', detail: 'Se propone y se decide', statuses: ['draft', 'pending_approval', 'needs_changes'] },
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
  draft: 'BORRADOR', pending_approval: 'ESPERANDO AL CLIENTE', needs_changes: 'AJUSTES SOLICITADOS',
  approved: 'IDEA APROBADA', script_in_progress: 'GUIÓN EN CONSTRUCCIÓN', pending_script_review: 'GUIÓN POR APROBAR',
  script_approved: 'GUIÓN APROBADO', in_production: 'RODAJE EN CURSO', raw_uploaded: 'CRUDO CARGADO',
  editing: 'EN EDICIÓN', ready_to_publish: 'REVISIÓN FINAL', published: 'PUBLICADO', closed: 'CERRADO',
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  owner: 'OWNER', creator: 'CREATIVA', camera: 'CÁMARA', model: 'MODELO', editor: 'EDITOR',
  publisher: 'PUBLISHER', media_buyer: 'PAUTA', client_approver: 'CLIENTE', client_viewer: 'CLIENTE (LECTURA)',
};

/** What each role is responsible for, and where its queue lives. */
export const ROLE_HOME: Record<RoleKey, { queue: string; headline: string; explanation: string }> = {
  owner: { queue: '/aprobaciones', headline: 'DESTRABA Y ACOMPAÑA', explanation: 'Preparas propuestas, consigues decisiones del cliente y confirmas el siguiente relevo.' },
  creator: { queue: '/ideas', headline: 'PROPONES Y AJUSTAS', explanation: 'Conviertes referencias en propuestas claras y respondes los ajustes sin perder contexto.' },
  camera: { queue: '/produccion', headline: 'RUEDAS LO APROBADO', explanation: 'Solo ves piezas con guion aprobado. Sigues el brief y subes el crudo.' },
  model: { queue: '/produccion', headline: 'EJECUTAS EL TALENTO', explanation: 'Ves vestuario, actitud y referencias de las piezas listas para rodar.' },
  editor: { queue: '/produccion', headline: 'MONTAJAS Y ENTREGAS', explanation: 'Recibes el crudo centralizado, conservas versiones y entregas un corte para revisión.' },
  publisher: { queue: '/publicaciones', headline: 'PUBLICAS CON EVIDENCIA', explanation: 'Solo recibes piezas aprobadas. Registras canal, URL y evidencia de salida.' },
  media_buyer: { queue: '/publicaciones', headline: 'MIDE Y OPTIMIZA', explanation: 'Registras hipótesis, resultados y qué formato conviene repetir.' },
  client_approver: { queue: '/aprobaciones', headline: 'DECIDES', explanation: 'Ves la propuesta, la referencia y el guion. Apruebas o pides ajustes.' },
  client_viewer: { queue: '/aprobaciones', headline: 'CONSULTAS', explanation: 'Ves el avance del proyecto sin editar nada.' },
};

type Transition = { to: WorkflowStatus; label: string; note: string; roles: 'team' | 'client' | 'all' };

/** A status offers few, explicit moves. Roles decide which ones you actually see. */
const TRANSITIONS: Partial<Record<WorkflowStatus, Transition[]>> = {
  draft: [
    { to: 'pending_approval', label: 'ENVIAR IDEA AL CLIENTE', note: 'Propuesta enviada para decisión del cliente.', roles: 'team' },
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
    { to: 'needs_changes', label: 'PEDIR CAMBIOS AL GUIÓN', note: 'El cliente pidió cambios en el guion.', roles: 'client' },
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
    { to: 'published', label: 'APROBAR Y PUBLICAR', note: 'Revisión final aprobada; pieza publicada.', roles: 'all' },
  ],
  published: [
    { to: 'closed', label: 'CERRAR FLUJO', note: 'Pieza cerrada conservando todo su historial.', roles: 'team' },
  ],
};

const ROLE_SIDE: Record<RoleKey, 'team' | 'client'> = {
  owner: 'team', creator: 'team', camera: 'team', model: 'team', editor: 'team',
  publisher: 'team', media_buyer: 'team', client_approver: 'client', client_viewer: 'client',
};

/** Only these roles may move a piece forward from each status. */
const STATUS_OWNERS: Record<WorkflowStatus, RoleKey[]> = {
  draft: ['owner', 'creator'], pending_approval: [], needs_changes: ['owner', 'creator'],
  approved: ['owner', 'creator'], script_in_progress: ['owner', 'creator', 'editor'],
  pending_script_review: [], script_approved: ['owner', 'camera', 'model'],
  in_production: ['camera', 'model', 'owner'], raw_uploaded: ['editor', 'owner'],
  editing: ['editor', 'owner'], ready_to_publish: ['owner', 'publisher', 'media_buyer'],
  published: ['publisher', 'media_buyer', 'owner'], closed: [],
};

export type AllowedTransition = { to: WorkflowStatus; label: string; note: string };

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
      return STATUS_OWNERS[status].includes(role);
    })
    .map(({ to, label, note }) => ({ to, label, note }));
}

/** Who the piece is waiting for right now — used for the "waiting on" banner. */
export function waitingOn(status: WorkflowStatus): string {
  const owners = STATUS_OWNERS[status];
  if (status === 'pending_approval' || status === 'pending_script_review') return 'el cliente';
  if (!owners.length) return 'nadie: flujo cerrado';
  return owners.map((role) => ROLE_LABEL[role]).join(' o ');
}

export function nextStatus(status: WorkflowStatus): WorkflowStatus {
  const options = TRANSITIONS[status] ?? [];
  return options[0]?.to ?? status;
}

/* ───────────────────────────────────────────────────────────────────────────
 * PRESENTACIÓN POR ESTADO
 *
 * Cada estado se comunica con CUATRO señales a la vez (ícono + color + texto +
 * responsable) para que nadie dependa solo del color: si alguien no distingue
 * mostaza de fucsia, el ícono y el texto siguen contando la historia.
 *
 * Tonos B.U.C.M.:
 *   mostaza  → espera al CLIENTE (atención, decisión pendiente)
 *   fucsia   → está en PRODUCCIÓN (rodaje, edición, publicación)
 *   orquidea → está en REVISIÓN interna (alguien del equipo debe actuar)
 *   neutro   → borrador, publicado o cerrado
 * ─────────────────────────────────────────────────────────────────────────── */
export type ToneKey = 'neutro' | 'mostaza' | 'fucsia' | 'orquidea';

export type StatusMeta = { label: string; icon: string; tone: ToneKey; who: string; blurb: string };

export const STATUS_META: Record<WorkflowStatus, StatusMeta> = {
  draft: { label: 'BORRADOR', icon: '✎', tone: 'neutro', who: 'CREATIVA', blurb: 'Aún se está escribiendo; todavía no viaja al cliente.' },
  pending_approval: { label: 'ESPERA CLIENTE', icon: '⏱', tone: 'mostaza', who: 'CLIENTE', blurb: 'La propuesta está en manos del cliente para su decisión.' },
  needs_changes: { label: 'AJUSTES PEDIDOS', icon: '↺', tone: 'fucsia', who: 'CREATIVA', blurb: 'El cliente pidió cambios; la pelota vuelve al equipo.' },
  approved: { label: 'IDEA APROBADA', icon: '✓', tone: 'mostaza', who: 'CREATIVA', blurb: 'Dirección aprobada. Arranca la escritura del guion.' },
  script_in_progress: { label: 'GUIÓN EN CURSO', icon: '✍', tone: 'orquidea', who: 'CREATIVA', blurb: 'Se está escribiendo el guion de la pieza.' },
  pending_script_review: { label: 'GUIÓN POR APROBAR', icon: '⏱', tone: 'mostaza', who: 'CLIENTE', blurb: 'El guion espera la validación del cliente.' },
  script_approved: { label: 'GUIÓN APROBADO', icon: '✓', tone: 'mostaza', who: 'CÁMARA', blurb: 'Listo para rodar. El equipo de cámara ya tiene su brief.' },
  in_production: { label: 'GRABANDO', icon: '🎬', tone: 'fucsia', who: 'CÁMARA', blurb: 'Rodaje en curso; el crudo todavía no está cargado.' },
  raw_uploaded: { label: 'CRUDO SUBIDO', icon: '⬆', tone: 'orquidea', who: 'EDITOR', blurb: 'El material crudo está cargado y listo para montaje.' },
  editing: { label: 'EDITANDO', icon: '✏', tone: 'fucsia', who: 'EDITOR', blurb: 'Montaje en curso sobre el crudo.' },
  ready_to_publish: { label: 'REVISIÓN FINAL', icon: '◎', tone: 'orquidea', who: 'OWNER · PUBLISHER', blurb: 'Corte listo; falta la última aprobación antes de salir.' },
  published: { label: 'PUBLICADO', icon: '✓✓', tone: 'fucsia', who: 'PUBLISHER', blurb: 'La pieza ya salió con su evidencia registrada.' },
  closed: { label: 'CERRADO', icon: '⊗', tone: 'neutro', who: '—', blurb: 'Flujo terminado; se conserva todo el historial.' },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as WorkflowStatus] ?? { label: status, icon: '•', tone: 'neutro', who: 'RR ALIADOS', blurb: '' };
}

/** Groups the 13 states into the five hand-offs a person actually filters by. */
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

/** Tailwind classes per tone, reused by badges, rails and filters. */
export const TONE_CLASS: Record<ToneKey, { border: string; bg: string; text: string; dot: string }> = {
  mostaza: { border: 'border-mostaza', bg: 'bg-mostaza/10', text: 'text-mostaza', dot: 'bg-mostaza' },
  fucsia: { border: 'border-fucsia', bg: 'bg-fucsia/10', text: 'text-fucsia', dot: 'bg-fucsia' },
  orquidea: { border: 'border-orquidea', bg: 'bg-orquidea/10', text: 'text-orquidea', dot: 'bg-orquidea' },
  neutro: { border: 'border-blanco-20', bg: 'bg-blanco-05', text: 'text-blanco-60', dot: 'bg-blanco-40' },
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
