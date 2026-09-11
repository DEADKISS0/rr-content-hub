'use client';

import Link from 'next/link';
import { useMemo } from 'react';

type Idea = { status: string };
type Role = 'ADMIN' | 'OWNER' | 'CREATIVA' | 'CÁMARA' | 'MODELO' | 'EDITOR' | 'PUBLISHER' | 'CLIENTE';
const roleRoutes: Record<Role, { href: string; action: string; explanation: string; statuses: string[] }> = {
  ADMIN: { href: '/aprobaciones', action: 'RESOLVER BLOQUEOS', explanation: 'No ejecuta cada tarea: despeja decisiones, responsables y fechas para que el flujo no se detenga.', statuses: ['pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'] },
  OWNER: { href: '/aprobaciones', action: 'PRESENTAR Y DESTRABAR', explanation: 'Prepara propuestas, acompaña decisiones del cliente y confirma el siguiente relevo.', statuses: ['draft', 'pending_approval', 'needs_changes', 'pending_script_review', 'ready_to_publish'] },
  CREATIVA: { href: '/ideas', action: 'COMPLETAR IDEAS', explanation: 'Convierte referencias en propuestas claras y responde ajustes sin perder el contexto.', statuses: ['draft', 'needs_changes'] },
  CÁMARA: { href: '/produccion', action: 'VER RODAJES', explanation: 'Ve solo piezas con guion aprobado o rodaje activo; carga crudo al terminar.', statuses: ['script_approved', 'in_production'] },
  MODELO: { href: '/produccion', action: 'VER SESIONES', explanation: 'Ve vestuario, actitud y referencias de las piezas que ya pueden rodarse.', statuses: ['script_approved', 'in_production'] },
  EDITOR: { href: '/produccion', action: 'VER ENTREGAS', explanation: 'Recibe crudo centralizado, conserva versiones y entrega un corte para revisión.', statuses: ['raw_uploaded', 'editing'] },
  PUBLISHER: { href: '/publicaciones', action: 'VER SALIDAS', explanation: 'Solo recibe piezas con revisión final; registra canal, URL y evidencia de salida.', statuses: ['ready_to_publish', 'published'] },
  CLIENTE: { href: '/aprobaciones', action: 'REVISAR DECISIONES', explanation: 'Ve la propuesta, la referencia y el guion. Puede aprobar, pedir ajustes o archivar.', statuses: ['pending_approval', 'pending_script_review', 'ready_to_publish'] },
};

export function RoleCommandCenter({ projectSlug, ideas, defaultRole }: { projectSlug: string; ideas: Idea[]; defaultRole: string }) {
  const normalized = defaultRole.toUpperCase();
  const role: Role = (normalized.includes('ADMIN') ? 'ADMIN' : normalized.includes('CLIENT') ? 'CLIENTE' : normalized.includes('CAM') ? 'CÁMARA' : normalized.includes('MODEL') ? 'MODELO' : normalized.includes('EDIT') ? 'EDITOR' : normalized.includes('PAUTA') || normalized.includes('PUBLISH') ? 'PUBLISHER' : normalized.includes('CREAT') ? 'CREATIVA' : 'OWNER') as Role;
  const config = roleRoutes[role]; const pending = useMemo(() => ideas.filter((idea) => config.statuses.includes(idea.status)).length, [config, ideas]);
  const adminCounts = { decisions: ideas.filter((idea) => ['pending_approval', 'pending_script_review', 'ready_to_publish'].includes(idea.status)).length, production: ideas.filter((idea) => ['script_approved', 'in_production', 'raw_uploaded', 'editing'].includes(idea.status)).length, published: ideas.filter((idea) => idea.status === 'published').length };
  return <section className="mb-12 border-2 border-blanco p-6 sm:p-8" aria-labelledby="role-command-title"><div className="max-w-2xl"><p className="eyebrow">[TU VISTA DE TRABAJO · {role}]</p><h2 id="role-command-title" className="mt-3 font-display text-3xl font-bold text-blanco sm:text-4xl">UNA SOLA OPERACIÓN.<br/><span className="text-mostaza">UN RELEVO A LA VEZ.</span></h2><p className="mt-4 text-sm leading-7 text-blanco-60">Esta vista se asigna automáticamente con tus credenciales y permisos de proyecto. Muestra tu cola y el siguiente paso, sin ruido operativo innecesario.</p></div>
    {role === 'ADMIN' ? <div className="mt-8 grid gap-3 border-t border-blanco-20 pt-6 md:grid-cols-3"><AdminCard count={adminCounts.decisions} label="DECISIONES BLOQUEADAS" detail="Cliente, guion o revisión final" href={`/${projectSlug}/aprobaciones`}/><AdminCard count={adminCounts.production} label="PIEZAS EN EJECUCIÓN" detail="Rodaje, crudo o edición" href={`/${projectSlug}/produccion`}/><AdminCard count={adminCounts.published} label="SALIDAS REGISTRADAS" detail="Listas para medir y cerrar" href={`/${projectSlug}/publicaciones`}/></div> : <div className="mt-8 border-t border-blanco-20 pt-6"><div className="grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-center"><div className="font-display text-6xl font-bold text-mostaza">{pending}</div><div><p className="mono-label text-mostaza">[TU COLA · {role}]</p><h3 className="mt-2 font-display text-2xl font-bold text-blanco">{pending ? `TIENES ${pending} PIEZA${pending === 1 ? '' : 'S'} PARA REVISAR.` : 'NO HAY RELEVOS PENDIENTES.'}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-blanco-60">{config.explanation}</p></div><Link href={`/${projectSlug}${config.href}`} className="btn-brutal-mostaza text-center">{config.action} →</Link></div></div>}
  </section>;
}
function AdminCard({ count, label, detail, href }: { count: number; label: string; detail: string; href: string }) { return <Link href={href} className="group border border-blanco-20 bg-blanco-05 p-5 hover:border-fucsia"><p className="font-display text-5xl font-bold text-mostaza">{count}</p><p className="mt-3 font-mono text-[10px] text-blanco">{label} <span className="text-fucsia group-hover:text-mostaza">↗</span></p><p className="mt-2 text-xs leading-5 text-blanco-60">{detail}</p></Link>; }
