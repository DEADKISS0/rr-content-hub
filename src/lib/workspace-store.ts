'use client';

export type LocalIdea = {
  id: string; code: string; title: string; description: string; objective: string;
  content_type: 'organic' | 'paid'; category: string; status: string; priority: 'high' | 'normal';
  creator: string; created_at: string; reference_url?: string; camera: string; talent: string; edit: string;
};

const key = (projectSlug: string) => `rr-content-hub:${projectSlug}:ideas`;
const changed = 'rr-content-hub:changed';

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

export function subscribeWorkspace(projectSlug: string, listener: () => void) {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ projectSlug: string }>;
    if (!custom.detail || custom.detail.projectSlug === projectSlug) listener();
  };
  window.addEventListener(changed, handler);
  window.addEventListener('storage', handler);
  return () => { window.removeEventListener(changed, handler); window.removeEventListener('storage', handler); };
}
