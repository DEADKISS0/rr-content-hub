'use client';

import { useState } from 'react';
import { contentMeta, contentMonths, designMeta, designRoadmap, devMeta, devRoadmap, PILLAR_LABEL } from '@/lib/roadmap';

type Track = 'dev' | 'design' | 'content';

const TRACKS: Array<{ key: Track; label: string; kicker: string }> = [
  { key: 'dev', label: 'DESARROLLO', kicker: 'Sistema y tienda' },
  { key: 'design', label: 'DISEÑO', kicker: 'Branding y creativos' },
  { key: 'content', label: 'CONTENIDO', kicker: 'Producción semanal' },
];

export function RoadmapView() {
  const [track, setTrack] = useState<Track>('dev');

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
      <header className="mb-8 border-b border-blanco-10 pb-8">
        <p className="eyebrow">[WUNDEER · ROADMAP]</p>
        <h1 className="display-title">LA RUTA<br /><em>AL GO-LIVE.</em></h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-blanco-60">Tres pistas en paralelo: desarrollo, diseño y creación de contenido. Cada una avanza hacia el lanzamiento del 1 de octubre y la operación de los cinco meses siguientes.</p>
      </header>

      <nav className="mb-8 grid grid-cols-3 border-2 border-blanco-10" aria-label="Pistas del roadmap">
        {TRACKS.map((item) => <button key={item.key} onClick={() => setTrack(item.key)} className={`px-3 py-4 text-left transition-colors ${track === item.key ? 'border-b-2 border-mostaza bg-mostaza/10' : 'text-blanco-40 hover:bg-blanco-05 hover:text-blanco'}`}><strong className="block font-mono text-[10px] sm:text-xs">{item.label}</strong><small className="mt-1 hidden text-[10px] text-blanco-40 sm:block">{item.kicker}</small></button>)}
      </nav>

      {track === 'dev' && <DevTrack />}
      {track === 'design' && <DesignTrack />}
      {track === 'content' && <ContentTrack />}
    </div>
  </main>;
}

function MetaGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="grid gap-px border-2 border-blanco-10 bg-blanco-10 sm:grid-cols-2 lg:grid-cols-4">
    {items.map(([label, value]) => <div key={label} className="bg-negro p-4"><p className="mono-label text-mostaza">{label}</p><p className="mt-2 font-mono text-sm leading-6 text-blanco">{value}</p></div>)}
  </div>;
}

function DevTrack() {
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[['INICIO', devMeta.start], ['GO-LIVE', devMeta.goLive], ['SPRINTS', devMeta.sprints], ['ARQUITECTURA', devMeta.architecture]]} />
    <div className="border-l-4 border-mostaza bg-blanco-05 p-5"><p className="eyebrow">PRINCIPIO DE ENTREGA</p><p className="mt-3 text-sm leading-7 text-blanco-60">{devMeta.principle}</p></div>
    <ol className="space-y-5">
      {devRoadmap.map((sprint, index) => <li key={sprint.title} className="border-2 border-blanco-10 bg-blanco-05 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">SPRINT {index + 1}</p><h2 className="mt-2 font-display text-2xl font-bold text-blanco">{sprint.title}</h2><p className="mt-1 font-mono text-[10px] text-mostaza">{sprint.dates}</p></div><span className="border border-mostaza px-3 py-1 font-mono text-[10px] text-mostaza">{sprint.focus.split('.')[0].toUpperCase()}</span></div>
        <p className="mt-4 text-sm leading-7 text-blanco-60">{sprint.focus}</p>
        {sprint.objective && <p className="mt-3 text-sm leading-7 text-blanco-40"><strong className="text-blanco-60">Objetivo:</strong> {sprint.objective}</p>}
        {sprint.modules && <div className="mt-5"><p className="mono-label text-fucsia">MÓDULOS QUE SE CONSTRUYEN</p><ul className="mt-3 space-y-2">{sprint.modules.map((module) => <li key={module} className="flex gap-2 border-l-2 border-fucsia pl-3 text-sm leading-6 text-blanco-60">{module}</li>)}</ul></div>}
        {sprint.deliverable && <div className="mt-5 border-t border-blanco-10 pt-4"><p className="mono-label text-orquidea">ENTREGABLE DEMO</p><p className="mt-2 text-sm leading-7 text-blanco-60">{sprint.deliverable}</p></div>}
        {sprint.note && <p className="mt-4 font-mono text-[10px] leading-5 text-blanco-40">↳ {sprint.note}</p>}
      </li>)}
    </ol>
  </div>;
}

function DesignTrack() {
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[['CLIENTE', designMeta.client], ['DIR. CREATIVO', designMeta.director], ['LANZAMIENTO', designMeta.launch], ['FOCO', 'UI/UX · Arte · Branding']]} />
    <div className="border-l-4 border-fucsia bg-blanco-05 p-5"><p className="eyebrow">OBJETIVO ESTRATÉGICO</p><p className="mt-3 text-sm leading-7 text-blanco-60">{designMeta.objective}</p></div>
    <ol className="space-y-5">
      {designRoadmap.map((sprint, index) => <li key={sprint.title} className="border-2 border-blanco-10 bg-blanco-05 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">SPRINT {index + 1}</p><h2 className="mt-2 font-display text-2xl font-bold text-blanco">{sprint.title}</h2><p className="mt-1 font-mono text-[10px] text-fucsia">{sprint.dates}</p></div></div>
        <p className="mt-4 text-sm leading-7 text-blanco-60">{sprint.focus}</p>
        {sprint.days && <div className="mt-5 space-y-3">{sprint.days.map((day) => <div key={day.label} className={`border p-4 ${day.urgent ? 'border-fucsia bg-fucsia/10' : 'border-blanco-10'}`}><div className="flex items-center justify-between gap-2"><p className="mono-label text-mostaza">{day.label} · {day.date}</p>{day.urgent && <span className="font-mono text-[10px] text-fucsia">URGENTE</span>}</div><ul className="mt-2 space-y-1.5">{day.items.map((item) => <li key={item} className="text-sm leading-6 text-blanco-60">— {item}</li>)}</ul></div>)}</div>}
      </li>)}
    </ol>
  </div>;
}

function ContentTrack() {
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[['CADENCIA', 'Sábados'], ['POR SESIÓN', '5 piezas'], ['ENTREGAS', 'Lun–Jue'], ['HORIZONTE', '5 meses']]} />
    <div className="border-l-4 border-orquidea bg-blanco-05 p-5"><p className="eyebrow">RITMO DE PRODUCCIÓN</p><p className="mt-3 text-sm leading-7 text-blanco-60">{contentMeta.cadence}. {contentMeta.perSession}. {contentMeta.delivery}.</p></div>
    <div className="grid gap-px border-2 border-blanco-10 bg-blanco-10 sm:grid-cols-2 lg:grid-cols-5">
      {['C1 → lunes', 'C2 → martes', 'C3 → miércoles', 'C4 → miércoles', 'C5 → jueves'].map((slot) => <div key={slot} className="bg-negro p-4"><p className="font-mono text-[10px] text-orquidea">{slot}</p></div>)}
    </div>
    <ol className="space-y-8">
      {contentMonths.map((month) => <li key={month.monthLabel}>
        <p className="eyebrow mb-4 border-b border-blanco-10 pb-2">{month.monthLabel.toUpperCase()}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {month.weeks.map((week) => <div key={week.week} className="border-2 border-blanco-10 bg-blanco-05 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-display text-lg font-bold text-blanco">Semana {week.week} · {week.theme}</p><span className="mt-1 block font-mono text-[10px] text-mostaza">{week.sessionLabel}</span></div>
            </div>
            <ol className="mt-4 space-y-2">
              {week.pieces.map((piece, index) => <li key={piece.topic} className="flex gap-3 border-l-2 border-orquidea pl-3">
                <span className="w-7 shrink-0 font-mono text-[10px] text-orquidea">C{index + 1}</span>
                <div className="min-w-0"><span className="font-mono text-[9px] uppercase tracking-wide text-fucsia">{PILLAR_LABEL[piece.pillar]}</span><p className="text-sm leading-6 text-blanco-60">{piece.topic}</p></div>
              </li>)}
            </ol>
            <p className="mt-4 border-t border-blanco-10 pt-3 font-mono text-[9px] leading-5 text-blanco-40">{week.deliveries.map((delivery) => `C${delivery.n} → ${delivery.day}`).join(' · ')}</p>
          </div>)}
        </div>
      </li>)}
    </ol>
  </div>;
}
