'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABEL, type RoleKey } from '@/lib/flow';
import { PUBLIC_MODE } from '@/lib/mode';

type Project = { id: string; name: string; slug: string };
type Profile = { id: string; email: string; full_name: string | null };
type Invite = { email: string; project_id: string; role_in_project: string };
type AccessRow = { user_id: string; project_id: string; role_in_project: string; profile?: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null };

const roles = [
  ['owner', 'Owner · dirige cliente y decisiones'], ['creator', 'Creativa · propone ideas y briefs'], ['camera', 'Cámara · rodaje y crudo'], ['model', 'Modelo · ejecución de talento'], ['editor', 'Editor · versiones y cortes'], ['publisher', 'Publisher · salidas y evidencia'], ['media_buyer', 'Pauta · objetivos y resultados'], ['client_approver', 'Cliente · aprueba ideas y guiones'], ['client_viewer', 'Cliente · consulta sin editar'],
];

const roleLabel = (value: string) => ROLE_LABEL[value as RoleKey] ?? value;

/**
 * Access admin grouped by project. Grouping answers the real question ("who is
 * on this project?") instead of showing one flat list of users.
 */
export function AccessAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [email, setEmail] = useState('');
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState('creator');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(() => Boolean(supabase));

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [projectRows, profileRows, inviteRows, accessRows] = await Promise.all([
      supabase.from('rr_hub_projects').select('id,name,slug').order('name'),
      supabase.from('rr_hub_profiles').select('id,email,full_name').order('email'),
      supabase.from('rr_hub_invites').select('email,project_id,role_in_project').order('email'),
      supabase.from('rr_hub_access').select('user_id,project_id,role_in_project, profile:rr_hub_profiles(email,full_name)'),
    ]);
    const nextProjects = projectRows.data ?? [];
    setProjects(nextProjects);
    setProfiles(profileRows.data ?? []);
    setInvites(inviteRows.data ?? []);
    setAccess((accessRows.data ?? []) as unknown as AccessRow[]);
    setProjectId((current) => current || nextProjects[0]?.id || '');
    setLoading(false);
  }, [supabase]);

  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) { setNotice('Supabase aún no está configurado. Consulta AUTH_SETUP.md antes de activar accesos.'); return; }
    const target = email.trim().toLowerCase();
    if (!target || !projectId) { setNotice('Escribe un correo y elige un proyecto.'); return; }

    const { error: inviteError } = await supabase
      .from('rr_hub_invites')
      .upsert({ email: target, project_id: projectId, role_in_project: role }, { onConflict: 'email,project_id' });
    if (inviteError) { setNotice(`No fue posible registrar la invitación: ${inviteError.message}`); return; }

    const profile = profiles.find((item) => item.email?.toLowerCase() === target);
    if (profile) {
      const { error: accessError } = await supabase
        .from('rr_hub_access')
        .upsert({ user_id: profile.id, project_id: projectId, role_in_project: role }, { onConflict: 'user_id,project_id' });
      if (accessError) { setNotice(`Invitación guardada, pero falló el acceso inmediato: ${accessError.message}`); return; }
      setNotice(`✓ ${profile.email} tiene acceso ${roleLabel(role)} en este proyecto.`);
    } else {
      setNotice(`✓ Invitación guardada para ${target}. Al entrar por primera vez con Google recibirá el acceso automáticamente.`);
    }
    setEmail('');
    refresh();
  }

  async function revoke(row: AccessRow) {
    const { error } = await supabase!.from('rr_hub_access').delete().eq('user_id', row.user_id).eq('project_id', row.project_id);
    if (error) { setNotice(`No se pudo revocar: ${error.message}`); return; }
    setNotice(`Acceso revocado a ${profileEmail(row)}.`);
    refresh();
  }

  const profileEmail = (row: AccessRow) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return profile?.email ?? row.user_id;
  };

  const accessByProject = useMemo(() => {
    const map = new Map<string, AccessRow[]>();
    for (const row of access) map.set(row.project_id, [...(map.get(row.project_id) ?? []), row]);
    return map;
  }, [access]);

  const invitesByProject = useMemo(() => {
    const map = new Map<string, Invite[]>();
    for (const row of invites) map.set(row.project_id, [...(map.get(row.project_id) ?? []), row]);
    return map;
  }, [invites]);

  if (PUBLIC_MODE) {
    return <section className="border-2 border-blanco p-6 sm:p-8">
      <p className="eyebrow">[ADMINISTRACIÓN DE ACCESOS]</p>
      <h2 className="mt-3 font-display text-4xl font-bold text-blanco">EQUIPO Y<br/><span className="text-mostaza">PROYECTOS.</span></h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-blanco-60">En modo público esta sección es de solo lectura. La asignación y revocación de accesos se reactiva al activar la autenticación.</p>
    </section>;
  }

  return <section className="border-2 border-blanco p-6 sm:p-8">
    <p className="eyebrow">[ADMINISTRACIÓN DE ACCESOS]</p>
    <h2 className="mt-3 font-display text-4xl font-bold text-blanco">EQUIPO Y<br/><span className="text-mostaza">PROYECTOS.</span></h2>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-blanco-60">Asigna una persona a un proyecto y define su relevo operativo. Si aún no ha iniciado sesión, la invitación queda guardada y se aplica automáticamente en su primer ingreso con Google.</p>
    {!supabase && <p role="status" className="mt-6 border-2 border-orquidea bg-orquidea/10 p-4 font-mono text-xs leading-6 text-blanco">[CONFIGURACIÓN PENDIENTE] El panel se activa al conectar la clave pública de Supabase.</p>}
    {loading ? <p className="mt-8 font-mono text-xs text-blanco-60">CARGANDO PROYECTOS Y PERFILES…</p> : <>
      <form onSubmit={grant} className="mt-8 grid gap-5 border-t border-blanco-20 pt-7 lg:grid-cols-2">
        <label><span className="mono-label mb-2 block text-mostaza">// CORREO DE GOOGLE</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-brutal" placeholder="persona@gmail.com" /></label>
        <label><span className="mono-label mb-2 block text-mostaza">// PROYECTO</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="input-brutal">{projects.length ? projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : <option value="">Sin proyectos cargados</option>}</select></label>
        <label className="lg:col-span-2"><span className="mono-label mb-2 block text-mostaza">// ROL EN ESTE PROYECTO</span><select value={role} onChange={(event) => setRole(event.target.value)} className="input-brutal">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="lg:col-span-2 flex flex-col gap-4 sm:flex-row sm:items-center"><button disabled={!supabase} className="btn-brutal" type="submit">ASIGNAR ACCESO →</button><span className="font-mono text-[10px] leading-5 text-blanco-40">Funciona incluso antes de que la persona inicie sesión.</span></div>
        {notice && <p role="status" className="lg:col-span-2 border border-mostaza bg-mostaza/10 p-4 font-mono text-xs leading-6 text-blanco anim-pop">{notice}</p>}
      </form>

      <div className="mt-10 border-t border-blanco-20 pt-8">
        <p className="eyebrow mb-5">[ACCESO POR PROYECTO]</p>
        <div className="space-y-6">
          {projects.map((project) => {
            const rows = accessByProject.get(project.id) ?? [];
            const pending = invitesByProject.get(project.id) ?? [];
            return <div key={project.id} className="border-2 border-blanco-20">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-blanco-20 bg-fucsia/10 px-5 py-3">
                <h3 className="font-display text-lg font-bold text-blanco">{project.name}</h3>
                <span className="font-mono text-[10px] text-mostaza">{rows.length} CON ACCESO · {pending.length} INVITADO(S)</span>
              </div>
              <div className="divide-y divide-blanco-10">
                {rows.map((row) => <div key={`${row.user_id}-${row.project_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div><p className="font-mono text-xs text-blanco">{profileEmail(row)}</p><p className="mt-1 font-mono text-[10px] text-fucsia">{roleLabel(row.role_in_project)}</p></div>
                  <button onClick={() => revoke(row)} className="font-mono text-[10px] text-orquidea underline hover:text-fucsia">REVOCAR</button>
                </div>)}
                {rows.length === 0 && <p className="px-5 py-4 font-mono text-[10px] text-blanco-40">SIN EQUIPO ASIGNADO.</p>}
                {pending.map((invite) => <div key={`inv-${invite.email}`} className="flex items-center justify-between gap-3 bg-mostaza/5 px-5 py-3">
                  <span className="min-w-0 truncate font-mono text-[10px] text-blanco-60">{invite.email}</span>
                  <span className="shrink-0 font-mono text-[10px] text-mostaza">{roleLabel(invite.role_in_project)} · PENDIENTE</span>
                </div>)}
              </div>
            </div>;
          })}
          {projects.length === 0 && <p className="font-mono text-xs text-blanco-40">SIN PROYECTOS CARGADOS.</p>}
        </div>
      </div>
    </>}
  </section>;
}
