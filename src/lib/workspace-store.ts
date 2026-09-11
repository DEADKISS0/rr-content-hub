'use client';

export type LocalIdea = {
  id: string; code: string; title: string; description: string; objective: string;
  content_type: 'organic' | 'paid'; category: string; status: string; priority: 'high' | 'normal';
  creator: string; created_at: string; reference_url?: string; camera: string; talent: string; edit: string;
};

export type WorkflowStatus =
  | 'draft' | 'pending_approval' | 'needs_changes' | 'approved'
  | 'script_in_progress' | 'pending_script_review' | 'script_approved'
  | 'in_production' | 'raw_uploaded' | 'editing' | 'ready_to_publish'
  | 'published' | 'closed';

export type WorkflowEvent = { id: string; status: WorkflowStatus; actor: string; note: string; createdAt: string };

const key = (projectSlug: string) => `rr-content-hub:${projectSlug}:ideas`;
const changed = 'rr-content-hub:changed';
const workflowKey = (projectSlug: string) => `rr-content-hub:${projectSlug}:workflow`;
const historyKey = (projectSlug: string, ideaId: string) => `rr-content-hub:${projectSlug}:history:${ideaId}`;

export function readLocalIdeas(projectSlug: string): LocalIdea[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(key(projectSlug)) || '[]'); } catch { return []; }
}

export function writeLocalIdeas(projectSlug: string, ideas: LocalIdea[]) {
  window.localStorage.setItem(key(projectSlug), JSON.stringify(ideas));
  window.dispatchEvent(new CustomEvent(changed, { detail: { projectSlug } }));
}

export function createLocalIdea(projectSlug: string, idea: Omit<LocalIdea, 'id' | 'code' | 'created_at'>) {
  const ideas = readLocalIdeas(projectSlug);
  const next = ideas.length + 100;
  const record: LocalIdea = { ...idea, id: `local-${crypto.randomUUID()}`, code: `N${next}`, created_at: new Date().toISOString() };
  writeLocalIdeas(projectSlug, [record, ...ideas]);
  return record;
}

export function updateLocalIdea(projectSlug: string, ideaId: string, patch: Partial<LocalIdea>) {
  const ideas = readLocalIdeas(projectSlug).map((idea) => idea.id === ideaId ? { ...idea, ...patch } : idea);
  writeLocalIdeas(projectSlug, ideas);
}

/** Temporary browser-backed workflow. The Supabase adapter will replace these keys without changing the UI contract. */
export function readWorkflowStatus(projectSlug: string, ideaId: string, fallback: string): WorkflowStatus {
  if (typeof window === 'undefined') return fallback as WorkflowStatus;
  try { return (JSON.parse(window.localStorage.getItem(workflowKey(projectSlug)) || '{}')[ideaId] ?? fallback) as WorkflowStatus; } catch { return fallback as WorkflowStatus; }
}

export function readWorkflowHistory(projectSlug: string, ideaId: string): WorkflowEvent[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(historyKey(projectSlug, ideaId)) || '[]'); } catch { return []; }
}

export function transitionWorkflow(projectSlug: string, ideaId: string, status: WorkflowStatus, actor: string, note: string) {
  const statuses = typeof window === 'undefined' ? {} : JSON.parse(window.localStorage.getItem(workflowKey(projectSlug)) || '{}');
  statuses[ideaId] = status;
  window.localStorage.setItem(workflowKey(projectSlug), JSON.stringify(statuses));
  const history = readWorkflowHistory(projectSlug, ideaId);
  history.unshift({ id: crypto.randomUUID(), status, actor, note, createdAt: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) });
  window.localStorage.setItem(historyKey(projectSlug, ideaId), JSON.stringify(history));
  if (ideaId.startsWith('local-')) updateLocalIdea(projectSlug, ideaId, { status });
  window.dispatchEvent(new CustomEvent(changed, { detail: { projectSlug } }));
}

export function subscribeWorkspace(projectSlug: string, listener: () => void) {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ projectSlug: string }>;
    if (!custom.detail || custom.detail.projectSlug === projectSlug) listener();
  };
  window.addEventListener(changed, handler);
  window.addEventListener('storage', handler);
  return () => { window.removeEventListener(changed, handler); window.removeEventListener('storage', handler); };
}
