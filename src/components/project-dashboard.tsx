import Link from 'next/link';
import { ProjectMap, type BoardIdea } from '@/components/project-map';
import { Chip, Initials } from '@/components/ui/chips';
import { Icon } from '@/components/ui/icons';
import { ROLE_LABEL, statusMeta, type RoleKey } from '@/lib/flow';

type Project = { name: string; client_name: string; description?: string | null };

const WAITING_STATUSES = ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'];

/**
 * Pantalla principal de un proyecto.
 *
 * Orden de lectura deliberado: quién eres y qué se puede hacer (cabecera) →
 * dónde está todo (mapa) → qué está trabado y por quién (panel de bloqueos).
 * El panel de bloqueos ya no es un número: son piezas concretas con su
 * responsable delante.
 */
export function ProjectDashboard({ project, projectSlug, ideas, role }: { project: Project; projectSlug: string; ideas: BoardIdea[]; role: string }) {
  const waiting = ideas.filter((idea) => WAITING_STATUSES.includes(idea.status));
  const byActor = waiting.reduce<Record<string, BoardIdea[]>>((groups, idea) => {
    const who = statusMeta(idea.status).who;
    groups[who] = [...(groups[who] ?? []), idea];
    return groups;
  }, {});
  const roleLabel = ROLE_LABEL[role as RoleKey] ?? role.toUpperCase();

  return (
    <main className="min-h-screen bg-negro">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
        <header className="anim-rise mb-10 grid gap-8 border-b-2 border-blanco pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="eyebrow">[{project.name.toUpperCase()} · OPERACIÓN VIVA]</p>
            <h1 className="display-title">EL TRABAJO<br /><em>VISIBLE.</em></h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-blanco-70">
              {project.description ?? 'Cada pieza avanza de izquierda a derecha. El ícono, el color y el texto te dicen quién tiene la pelota.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Chip icon="user" tone="blanco">TU ROL: {roleLabel}</Chip>
              <Chip icon="pieces" tone="neutro">{ideas.length} PIEZAS EN EL HUB</Chip>
              <Chip icon="alert" tone={waiting.length ? 'mostaza' : 'neutro'}>{waiting.length} PIEZAS PARADAS</Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${projectSlug}/ideas`} className="btn-brutal inline-flex items-center gap-2">VER TODO <Icon name="arrow" size={14} /></Link>
            <Link href={`/${projectSlug}/ideas/nueva`} className="btn-brutal-mostaza inline-flex items-center gap-2"><Icon name="plus" size={14} /> NUEVA IDEA</Link>
          </div>
        </header>

        <ProjectMap ideas={ideas} projectSlug={projectSlug} />

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="border-2 border-fucsia bg-fucsia/10 p-6 sm:p-8">
            <p className="eyebrow">[QUÉ ESTÁ DETENIDO]</p>
            <p className="mt-3 font-display text-6xl font-bold leading-none text-blanco">{waiting.length}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-blanco">{waiting.length ? 'PIEZAS PARADAS.' : 'TODO AVANZA.'}</h2>
            <p className="mt-3 text-sm leading-6 text-blanco-70">
              {waiting.length
                ? `Ninguna avanza sin que alguien responda: ${waiting.filter((idea) => statusMeta(idea.status).who === 'CLIENTE').length} esperan al cliente y ${waiting.filter((idea) => statusMeta(idea.status).who !== 'CLIENTE').length} al equipo de RR.`
                : 'No hay bloqueos pendientes en este momento.'}
            </p>
            <Link href={`/${projectSlug}/aprobaciones`} className="mt-5 inline-flex items-center gap-2 font-mono text-xs text-mostaza underline">VER DECISIONES <Icon name="arrow" size={13} /></Link>
          </div>

          <div className="border-2 border-blanco p-5 sm:p-6">
            <p className="eyebrow">[QUIÉN ESTÁ ESPERANDO QUÉ]</p>
            {waiting.length ? (
              <ul className="mt-4 space-y-3">
                {Object.entries(byActor).map(([who, items]) => (
                  <li key={who} className="flex items-start gap-3 border-b border-blanco-10 pb-3 last:border-0 last:pb-0">
                    <Initials label={who} tone={who === 'CLIENTE' ? 'mostaza' : 'orquidea'} size={30} />
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-blanco-50">{who} · {items.length} PIEZA{items.length === 1 ? '' : 'S'}</p>
                      <p className="mt-1 truncate font-display text-sm font-bold text-blanco">
                        {items.map((idea) => idea.code ?? 'IDEA').join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-blanco-60">Nadie está bloqueado: el flujo avanza solo.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
