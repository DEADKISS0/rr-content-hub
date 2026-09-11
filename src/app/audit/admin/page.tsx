import Link from 'next/link';
import { getAuditProjects, getAuditRoster, getAuditSettings } from '@/lib/data';
import { ROLE_LABEL, type RoleKey } from '@/lib/flow';

export const dynamic = 'force-dynamic';

const roleLabel = (role: string) => ROLE_LABEL[role as RoleKey] ?? role;

function date(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

/** Read-only administrative audit: team roster, access matrix and pending invites. */
export default async function AuditAdmin() {
  const [projects, roster, settings] = await Promise.all([getAuditProjects(), getAuditRoster(), getAuditSettings()]);
  const open = Boolean(settings.enabled);
  const projectName = new Map((projects as any[]).map((project) => [project.id, project.name]));
  const profile = new Map((roster.profiles as any[]).map((row) => [row.id, row]));

  const admins = (roster.profiles as any[]).filter((row) => row.global_role === 'admin');
  const accessByProject = new Map<string, any[]>();
  for (const row of roster.access as any[]) {
    const list = accessByProject.get(row.project_id) ?? [];
    list.push(row);
    accessByProject.set(row.project_id, list);
  }

  return <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
    <header className="mb-10 border-b border-blanco-10 pb-8">
      <p className="eyebrow">[AUDITORÍA · PANEL ADMINISTRATIVO · SOLO LECTURA]</p>
      <h1 className="display-title">EQUIPO Y<br/><em>ACCESOS.</em></h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-blanco-60">Quién existe, con qué rol global, qué proyecto tiene asignado y qué invitaciones siguen pendientes de primer ingreso. Nada de esto se puede modificar desde aquí.</p>
      {!open && <p className="mt-5 border-2 border-mostaza px-4 py-3 font-mono text-[10px] text-mostaza">LA VENTANA DE AUDITORÍA ESTÁ CERRADA. LOS DATOS PUEDEN NO ESTAR DISPONIBLES.</p>}
    </header>

    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[ADMINISTRADORES GLOBALES]</p>
        <span className="font-mono text-[10px] text-mostaza">{admins.length} CUENTAS</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {admins.map((row: any) => <div key={row.id} className="flex items-center justify-between border-2 border-fucsia bg-fucsia/10 px-5 py-4">
          <div><p className="font-mono text-xs text-blanco">{row.email}</p><p className="mt-1 font-mono text-[10px] text-blanco-40">{row.full_name ?? 'SIN NOMBRE'}</p></div>
          <span className="border border-fucsia px-2 py-1 font-mono text-[10px] text-fucsia">ADMIN</span>
        </div>)}
        {admins.length === 0 && <p className="font-mono text-xs text-blanco-40">SIN ADMINISTRADORES VISIBLES.</p>}
      </div>
    </section>

    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[EQUIPO REGISTRADO]</p>
        <span className="font-mono text-[10px] text-blanco-40">{roster.profiles.length} CUENTAS</span>
      </div>
      <div className="overflow-x-auto border-2 border-blanco-20">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead><tr className="border-b border-blanco-20 bg-blanco-05">
            <th className="px-4 py-3 font-mono text-[10px] text-mostaza">CORREO</th>
            <th className="px-4 py-3 font-mono text-[10px] text-mostaza">NOMBRE</th>
            <th className="px-4 py-3 font-mono text-[10px] text-mostaza">ROL GLOBAL</th>
            <th className="px-4 py-3 font-mono text-[10px] text-mostaza">PROYECTOS</th>
            <th className="px-4 py-3 font-mono text-[10px] text-mostaza">DESDE</th>
          </tr></thead>
          <tbody>
            {(roster.profiles as any[]).map((row: any) => {
              const projects_of_user = (roster.access as any[]).filter((a) => a.user_id === row.id);
              return <tr key={row.id} className="border-b border-blanco-10">
                <td className="px-4 py-3 font-mono text-xs text-blanco">{row.email}</td>
                <td className="px-4 py-3 text-sm text-blanco-60">{row.full_name ?? '—'}</td>
                <td className="px-4 py-3"><span className={`border px-2 py-1 font-mono text-[10px] ${row.global_role === 'admin' ? 'border-fucsia text-fucsia' : 'border-blanco-20 text-blanco-60'}`}>{row.global_role === 'admin' ? 'ADMIN' : 'MIEMBRO'}</span></td>
                <td className="px-4 py-3 font-mono text-[10px] text-blanco-60">{projects_of_user.length ? projects_of_user.map((a) => `${projectName.get(a.project_id) ?? '?'} (${roleLabel(a.role_in_project)})`).join(' · ') : 'SIN ACCESOS'}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-blanco-40">{date(row.created_at)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>

    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[MATRIZ DE ACCESO POR PROYECTO]</p>
        <span className="font-mono text-[10px] text-blanco-40">{(roster.access as any[]).length} ASIGNACIONES</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(projects as any[]).map((project) => {
          const rows = accessByProject.get(project.id) ?? [];
          return <div key={project.id} className="border-2 border-blanco-20 p-5">
            <p className="mono-label text-mostaza">[{project.name}]</p>
            <p className="mt-1 font-mono text-[10px] text-blanco-40">{rows.length} PERSONA(S)</p>
            <ul className="mt-4 space-y-2">
              {rows.map((row) => <li key={row.user_id} className="border-b border-blanco-10 pb-2 font-mono text-[10px] text-blanco-60"><span className="text-blanco">{profile.get(row.user_id)?.email ?? row.user_id.slice(0, 8)}</span><br/><span className="text-fucsia">{roleLabel(row.role_in_project)}</span></li>)}
              {rows.length === 0 && <li className="font-mono text-[10px] text-blanco-40">SIN EQUIPO ASIGNADO.</li>}
            </ul>
          </div>;
        })}
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-end justify-between border-b border-blanco-10 pb-3">
        <p className="eyebrow">[INVITACIONES PENDIENTES DE PRIMER INGRESO]</p>
        <span className="font-mono text-[10px] text-blanco-40">{(roster.invites as any[]).length} CORREOS</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(roster.invites as any[]).map((row: any) => <div key={`${row.email}-${row.project_id}`} className="flex items-center justify-between border border-blanco-20 px-4 py-3">
          <span className="truncate font-mono text-[10px] text-blanco-60">{row.email}</span>
          <span className="shrink-0 font-mono text-[10px] text-mostaza">{projectName.get(row.project_id) ?? '?'} · {roleLabel(row.role_in_project)}</span>
        </div>)}
        {(roster.invites as any[]).length === 0 && <p className="font-mono text-xs text-blanco-40">SIN INVITACIONES PENDIENTES.</p>}
      </div>
    </section>

    <div className="mt-10 border-t border-blanco-10 pt-6">
      <Link href="/audit" className="font-mono text-xs text-blanco-60 hover:text-mostaza">← VOLVER AL PANORAMA</Link>
    </div>
  </div>;
}
