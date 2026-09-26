'use client';

import { useState } from 'react';
import { BigCount, Chip } from './ui/chips';
import { Icon, type IconName } from './ui/icons';
import {
  GO_LIVE_ISO, designMeta, designRoadmap, designWindows, devMeta, devRoadmap, devWindows,
  contentMeta, contentMonths, contentProgress, contentRoadmap, currentWeek, daysUntil, pendingDeliveries,
  PILLAR_LABEL, progressPct, weekState, windowGap, windowState, type WindowState,
} from '@/lib/roadmap';

type Track = 'dev' | 'design' | 'content';

const TRACKS: Array<{ key: Track; label: string; kicker: string; icon: IconName; units: number }> = [
  { key: 'dev', label: 'DESARROLLO', kicker: 'Sistema y tienda', icon: 'bolt', units: devWindows.length },
  { key: 'design', label: 'DISEÑO', kicker: 'Branding y creativos', icon: 'scissors', units: designWindows.length },
  { key: 'content', label: 'CONTENIDO', kicker: 'Producción semanal', icon: 'camera', units: contentRoadmap.length },
];

/**
 * Cada pista se mide contra su propio calendario. Antes las tres usaban el mismo
 * rango y mostraban el mismo porcentaje, que no decía nada.
 */
const TRACK_RANGE: Record<Track, [string, string]> = {
  dev: [devWindows[0].startIso, GO_LIVE_ISO],
  design: [designWindows[0].startIso, GO_LIVE_ISO],
  content: [
    contentRoadmap[0].sessionIso,
    contentRoadmap[contentRoadmap.length - 1].deliveries[contentRoadmap[contentRoadmap.length - 1].deliveries.length - 1].iso,
  ],
};

const TONE: Record<WindowState, 'fucsia' | 'mostaza' | 'neutro'> = {
  'en-curso': 'fucsia',
  pendiente: 'mostaza',
  cerrado: 'neutro',
};

const STATE_LABEL: Record<WindowState, string> = {
  'en-curso': 'EN CURSO',
  pendiente: 'PENDIENTE',
  cerrado: 'CERRADO',
};

/** Barra de avance de un tramo. Roja cuando está cerrado, para leerse de un golpe. */
function RailBar({ pct, tone = 'fucsia' }: { pct: number; tone?: 'fucsia' | 'mostaza' | 'neutro' }) {
  return <div className="rail" role="img" aria-label={`${pct}% del tramo`}>
    <span className={`rail-fill ${tone === 'mostaza' ? 'bg-mostaza' : tone === 'neutro' ? 'bg-blanco-30' : 'bg-fucsia'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
  </div>;
}

const longDate = (iso: string) => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(`${iso}T12:00:00Z`));

export function RoadmapView({ today }: { today: string }) {
  const [track, setTrack] = useState<Track>('dev');
  const toGoLive = daysUntil(GO_LIVE_ISO, today);
  const content = contentProgress(today);
  const semana = currentWeek(today);
  const devActivo = devWindows.find((w) => windowState(w, today) === 'en-curso');
  const designActivo = designWindows.find((w) => windowState(w, today) === 'en-curso');

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">

      {/* Cabecera: dónde estamos, no solo qué viene. */}
      <header className="anim-rise mb-8 border-b-2 border-blanco-20 pb-8">
        <p className="eyebrow">[WUNDEER · ROADMAP]</p>
        <h1 className="display-title">LA RUTA<br /><em>AL GO-LIVE.</em></h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-blanco-70">
          Tres pistas en paralelo —desarrollo, diseño y contenido— avanzando hacia el lanzamiento del 1 de octubre
          y la operación de los cinco meses siguientes. Hoy es {longDate(today)}.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip icon="target" tone={toGoLive <= 7 ? 'fucsia' : 'mostaza'}>
            {toGoLive > 0 ? `GO-LIVE EN ${toGoLive} DÍAS · 1 OCT` : toGoLive === 0 ? 'GO-LIVE HOY · 1 OCT' : `GO-LIVE HACE ${Math.abs(toGoLive)} DÍAS`}
          </Chip>
          <Chip icon="bolt" tone="neutro">{devWindows.length + designWindows.length} SPRINTS</Chip>
          <Chip icon="camera" tone="neutro">{content.done}/{content.total} SEMANAS DE CONTENIDO CERRADAS</Chip>
        </div>
      </header>

      {/* Panel de hoy: la respuesta a «¿en qué vamos?» sin abrir las tres pistas. */}
      <section className="anim-rise mb-8 grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-3" aria-label="Estado de hoy">
        <NowCell icon="bolt" label="DESARROLLO">
          {devActivo ? <><strong className="text-blanco">{devActivo.title.split('·')[1]?.trim() ?? devActivo.title}</strong>
            <span className="mt-1 block font-mono text-[10px] text-fucsia">{windowGap(devActivo, today)}</span></>
            : <span className="text-blanco-60">SIN SPRINT ABIERTO</span>}
        </NowCell>
        <NowCell icon="scissors" label="DISEÑO">
          {designActivo ? <><strong className="text-blanco">{designActivo.title.split('·')[1]?.trim() ?? designActivo.title}</strong>
            <span className="mt-1 block font-mono text-[10px] text-fucsia">{windowGap(designActivo, today)}</span></>
            : <span className="text-blanco-60">SIN SPRINT ABIERTO</span>}
        </NowCell>
        <NowCell icon="camera" label="CONTENIDO">
          {semana ? <><strong className="text-blanco">SEMANA {semana.week} · {semana.theme}</strong>
            <span className="mt-1 block font-mono text-[10px] text-mostaza">
              {weekState(semana, today) === 'cerrado' ? 'CERRADA' : `${pendingDeliveries(semana, today)} ENTREGAS PENDIENTES`}
            </span></> : <span className="text-blanco-60">SIN PLAN ACTIVO</span>}
        </NowCell>
      </section>

      {/* Pistas: cada una con su avance medido, no solo su nombre. */}
      <nav className="anim-rise mb-8 grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-3" aria-label="Pistas del roadmap">
        {TRACKS.map((item) => {
          const active = track === item.key;
          const pct = progressPct(TRACK_RANGE[item.key][0], TRACK_RANGE[item.key][1], today);
          return <button key={item.key} onClick={() => setTrack(item.key)} aria-pressed={active}
            className={`group bg-negro p-4 text-left transition-colors ${active ? 'text-blanco' : 'text-blanco-50 hover:bg-blanco-05 hover:text-blanco'}`}>
            <span className="flex items-center gap-2 font-mono text-[10px]">
              <Icon name={item.icon} size={14} className={active ? 'text-fucsia' : 'text-blanco-50'} />{item.label}
              <span className="ml-auto text-blanco-40">{item.units}</span>
            </span>
            <span className="mt-2 block font-display text-lg font-bold leading-tight">{item.kicker}</span>
            <span className="mt-3 block"><RailBar pct={pct} tone={active ? 'fucsia' : 'neutro'} /></span>
          </button>;
        })}
      </nav>

      {track === 'dev' && <DevTrack today={today} />}
      {track === 'design' && <DesignTrack today={today} />}
      {track === 'content' && <ContentTrack today={today} />}
    </div>
  </main>;
}

function NowCell({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return <div className="bg-negro p-4">
    <p className="mono-label flex items-center gap-2 text-blanco-50"><Icon name={icon} size={13} />{label}</p>
    <p className="mt-2 text-sm leading-6">{children}</p>
  </div>;
}

function MetaGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-2 lg:grid-cols-4">
    {items.map(([label, value]) => <div key={label} className="bg-negro p-4">
      <p className="mono-label text-mostaza">{label}</p>
      <p className="mt-2 font-mono text-sm leading-6 text-blanco">{value}</p>
    </div>)}
  </div>;
}

function SprintShell({ index, sprint, state, gap, pct, children }: {
  index: number; sprint: { title: string; dates: string; focus: string }; state: WindowState; gap: string; pct: number; children?: React.ReactNode;
}) {
  return <li className={`border-2 bg-negro p-5 sm:p-7 ${state === 'en-curso' ? 'border-fucsia' : 'border-blanco-20'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow">SPRINT {index + 1} · {sprint.dates}</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-blanco">{sprint.title}</h2>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Chip tone={TONE[state]}>{STATE_LABEL[state]}</Chip>
        <span className="font-mono text-[10px] text-blanco-50">{gap}</span>
      </div>
    </div>
    <div className="mt-4"><RailBar pct={pct} tone={state === 'en-curso' ? 'fucsia' : 'neutro'} /></div>
    <p className="mt-5 text-sm leading-7 text-blanco-70">{sprint.focus}</p>
    {children}
  </li>;
}

function DevTrack({ today }: { today: string }) {
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[['INICIO', devMeta.start], ['GO-LIVE', devMeta.goLive], ['SPRINTS', devMeta.sprints], ['ARQUITECTURA', devMeta.architecture]]} />
    <div className="border-l-4 border-mostaza bg-blanco-05 p-5">
      <p className="eyebrow">PRINCIPIO DE ENTREGA</p>
      <p className="mt-3 text-sm leading-7 text-blanco-70">{devMeta.principle}</p>
    </div>
    <ol className="space-y-5">
      {devRoadmap.map((sprint, index) => {
        const window = devWindows[index];
        const state = windowState(window, today);
        return <SprintShell key={sprint.title} index={index} sprint={sprint} state={state}
          gap={windowGap(window, today)} pct={progressPct(window.startIso, window.endIso, today)}>
          {sprint.objective && <p className="mt-3 text-sm leading-7 text-blanco-60"><strong className="text-blanco">Objetivo:</strong> {sprint.objective}</p>}
          {sprint.modules && <div className="mt-5">
            <p className="mono-label text-fucsia">MÓDULOS QUE SE CONSTRUYEN · {sprint.modules.length}</p>
            <ul className="mt-3 space-y-2">{sprint.modules.map((module) => <li key={module} className="border-l-2 border-fucsia pl-3 text-sm leading-6 text-blanco-70">{module}</li>)}</ul>
          </div>}
          {sprint.deliverable && <div className="mt-5 border-t border-blanco-20 pt-4">
            <p className="mono-label text-orquidea">ENTREGABLE DEMO</p>
            <p className="mt-2 text-sm leading-7 text-blanco-70">{sprint.deliverable}</p>
          </div>}
          {sprint.note && <p className="mt-4 font-mono text-[10px] leading-5 text-blanco-50">↳ {sprint.note}</p>}
        </SprintShell>;
      })}
    </ol>
  </div>;
}

function DesignTrack({ today }: { today: string }) {
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[['CLIENTE', designMeta.client], ['DIR. CREATIVO', designMeta.director], ['LANZAMIENTO', designMeta.launch], ['FOCO', 'UI/UX · Arte · Branding']]} />
    <div className="border-l-4 border-fucsia bg-blanco-05 p-5">
      <p className="eyebrow">OBJETIVO ESTRATÉGICO</p>
      <p className="mt-3 text-sm leading-7 text-blanco-70">{designMeta.objective}</p>
    </div>
    <ol className="space-y-5">
      {designRoadmap.map((sprint, index) => {
        const window = designWindows[index];
        const state = windowState(window, today);
        return <SprintShell key={sprint.title} index={index} sprint={sprint} state={state}
          gap={windowGap(window, today)} pct={progressPct(window.startIso, window.endIso, today)}>
          {sprint.days && <div className="mt-5 space-y-3">
            {sprint.days.map((day) => <div key={day.label} className={`border-2 p-4 ${day.urgent ? 'border-fucsia bg-fucsia/5' : 'border-blanco-20'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="mono-label text-mostaza">{day.label} · {day.date}</p>
                {day.urgent && <Chip icon="alert" tone="fucsia">CLAVE</Chip>}
              </div>
              <ul className="mt-2 space-y-1.5">{day.items.map((item) => <li key={item} className="text-sm leading-6 text-blanco-70">— {item}</li>)}</ul>
            </div>)}
          </div>}
        </SprintShell>;
      })}
    </ol>
  </div>;
}

function ContentTrack({ today }: { today: string }) {
  const semana = currentWeek(today);
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[['CADENCIA', 'Sábados'], ['POR SESIÓN', '5 piezas'], ['ENTREGAS', 'Lun–Jue'], ['HORIZONTE', '5 meses']]} />
    <div className="border-l-4 border-orquidea bg-blanco-05 p-5">
      <p className="eyebrow">RITMO DE PRODUCCIÓN</p>
      <p className="mt-3 text-sm leading-7 text-blanco-70">{contentMeta.cadence}. {contentMeta.perSession}. {contentMeta.delivery}.</p>
    </div>
    <div className="grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-5">
      {['C1 → lunes', 'C2 → martes', 'C3 → miércoles', 'C4 → miércoles', 'C5 → jueves'].map((slot) =>
        <div key={slot} className="bg-negro p-4"><p className="font-mono text-[10px] text-orquidea">{slot}</p></div>)}
    </div>
    <ol className="space-y-8">
      {contentMonths.map((month) => <li key={month.monthLabel}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-blanco-20 pb-2">
          <p className="eyebrow">{month.monthLabel.toUpperCase()}</p>
          <span className="font-mono text-[10px] text-blanco-50">{month.weeks.length} SEMANAS</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {month.weeks.map((week) => {
            const state = weekState(week, today);
            const esHoy = semana?.week === week.week;
            const pendientes = pendingDeliveries(week, today);
            return <div key={week.week} className={`border-2 bg-negro p-5 ${esHoy ? 'border-fucsia' : 'border-blanco-20'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-blanco">Semana {week.week} · {week.theme}</p>
                  <span className="mt-1 block font-mono text-[10px] text-mostaza">{week.sessionLabel}</span>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {esHoy && <Chip icon="pin" tone="fucsia">ESTA SEMANA</Chip>}
                  <Chip tone={TONE[state]}>{STATE_LABEL[state]}</Chip>
                </div>
              </div>
              <ol className="mt-4 space-y-2">
                {week.pieces.map((piece, index) => <li key={piece.topic} className="flex gap-3 border-l-2 border-orquidea pl-3">
                  <span className="w-7 shrink-0 font-mono text-[10px] text-orquidea">C{index + 1}</span>
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-fucsia">{PILLAR_LABEL[piece.pillar]}</span>
                    <p className="text-sm leading-6 text-blanco-70">{piece.topic}</p>
                  </div>
                </li>)}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-blanco-20 pt-3">
                <span className="font-mono text-[10px] text-blanco-50">ENTREGAS</span>
                {week.deliveries.map((delivery) => {
                  const entregada = delivery.iso <= today;
                  return <span key={delivery.n} className={`inline-flex items-center gap-1 font-mono text-[10px] ${entregada ? 'text-blanco-50' : 'text-mostaza'}`}
                    title={`C${delivery.n} · ${delivery.day} · ${delivery.iso}`}>
                    <Icon name={entregada ? 'check' : 'clock'} size={11} />C{delivery.n} {delivery.day}
                  </span>;
                })}
                <span className="ml-auto font-mono text-[10px] text-blanco-50">{pendientes ? `${pendientes} POR ENTREGAR` : 'TODO ENTREGADO'}</span>
              </div>
              {state === 'en-curso' && <p className="mt-3 font-mono text-[10px] text-fucsia">↳ SESIÓN DE GRABACIÓN {week.sessionLabel.toUpperCase()}</p>}
            </div>;
          })}
        </div>
      </li>)}
    </ol>
    <div className="grid gap-px border-2 border-blanco-20 bg-blanco-20 sm:grid-cols-3">
      <div className="bg-negro p-4"><BigCount value={contentProgress(today).done} label="SEMANAS CERRADAS" tone="mostaza" /></div>
      <div className="bg-negro p-4"><BigCount value={contentProgress(today).active} label="EN CURSO" tone="fucsia" /></div>
      <div className="bg-negro p-4"><BigCount value={contentProgress(today).total} label="EN EL PLAN" /></div>
    </div>
  </div>;
}
