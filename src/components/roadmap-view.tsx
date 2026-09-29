'use client';

import { useState } from 'react';
import { BigCount, Chip } from './ui/chips';
import { Icon, type IconName } from './ui/icons';
import {
  GO_LIVE_ISO, designMeta, designRoadmap, designWindows, devMeta, devRoadmap, devWindows,
  contentMeta, contentProgress, contentRoadmap, currentSession, daysUntil, sessionState,
  PILLAR_LABEL, progressPct, windowGap, windowState, type WindowState,
} from '@/lib/roadmap';

type Track = 'dev' | 'design' | 'content';

const TRACKS: Array<{ key: Track; label: string; kicker: string; icon: IconName; units: number }> = [
  { key: 'dev', label: 'DESARROLLO', kicker: 'Sistema y tienda', icon: 'bolt', units: devWindows.length },
  { key: 'design', label: 'DISEÑO', kicker: 'Branding y creativos', icon: 'scissors', units: designWindows.length },
  { key: 'content', label: 'CONTENIDO', kicker: 'Una sesión al mes', icon: 'camera', units: contentRoadmap.length },
];

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

const TRACK_ICON: Record<Track, IconName> = { dev: 'bolt', design: 'scissors', content: 'camera' };

/** Barra de avance de un tramo. Se lee de un golpe por contraste, no por color. */
function RailBar({ pct, tone = 'neutro' }: { pct: number; tone?: 'fucsia' | 'mostaza' | 'neutro' }) {
  return <div className="rail" role="img" aria-label={`${pct}% del tramo`}>
    <span className={`rail-fill ${tone === 'neutro' ? 'bg-blanco-30' : 'bg-blanco-50'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
  </div>;
}

const longDate = (iso: string) => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(`${iso}T12:00:00Z`));

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS_SEMANA = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Celda = {
  fecha: string;
  dia: number;
  mes: number;
  anio: number;
  semanaDelMes: number;
  hitos: Array<{ track: Track; title: string; pauta: boolean }>;
};

/**
 * El calendario, que es justo lo que se pidió: fechas que se vean de un golpe,
 * poco texto y modo calendario.
 *
 * Cada columna es un mes, cada fila una semana, y la celda solo dice dos cosas:
 * el número del día y qué hay encima. El detalle vive debajo, en corto. Un
 * calendario lleno de frases no se lee como calendario.
 */
function Calendario({ today }: { today: string }) {
  const fin = contentRoadmap[contentRoadmap.length - 1];
  const anioFin = Number(fin.closeIso.slice(0, 4));
  const mesFin = Number(fin.closeIso.slice(5, 7));
  const ultimo = new Date(anioFin, mesFin, 0);

  // Todos los tramos de los tres tracks, para poder pintar cada celda.
  const tramos: Array<{ track: Track; startIso: string; endIso: string; title: string }> = [
    ...devWindows.map((w) => ({ track: 'dev' as Track, startIso: w.startIso, endIso: w.endIso, title: w.title })),
    ...designWindows.map((w) => ({ track: 'design' as Track, startIso: w.startIso, endIso: w.endIso, title: w.title })),
    ...contentRoadmap.map((s) => ({ track: 'content' as Track, startIso: s.sessionIso, endIso: s.closeIso, title: s.theme })),
  ];

  // Primer lunes de la semana que contiene el arranque.
  const arranque = new Date(Number(GO_LIVE_ISO.slice(0, 4)), Number(GO_LIVE_ISO.slice(5, 7)) - 1, Number(GO_LIVE_ISO.slice(8, 10)));
  const cursor = new Date(arranque);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

  const semanas: Celda[][] = [];
  const mesActual = { anio: arranque.getFullYear(), mes: arranque.getMonth() + 1 };
  const meses: Array<{ anio: number; mes: number }> = [];

  while (cursor <= ultimo) {
    if (meses.at(-1)?.anio !== mesActual.anio || meses.at(-1)?.mes !== mesActual.mes) {
      meses.push({ ...mesActual });
    }
    const fila: Celda[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i);
      const fecha = iso(d);
      fila.push({
        fecha,
        dia: d.getDate(),
        mes: d.getMonth() + 1,
        anio: d.getFullYear(),
        semanaDelMes: Math.floor((d.getDate() - 1) / 7) + 1,
        hitos: tramos
          .filter((t) => fecha >= t.startIso && fecha <= t.endIso)
          .map((t) => ({ track: t.track, title: t.title, pauta: t.track === 'content' })),
      });
    }
    semanas.push(fila);
    cursor.setDate(cursor.getDate() + 7);
    mesActual.anio = cursor.getFullYear();
    mesActual.mes = cursor.getMonth() + 1;
  }

  return <div className="overflow-x-auto">
    <div className="min-w-[52rem]">
      <div className="grid grid-cols-7 border-l border-t border-blanco-20">
        {DIAS_SEMANA.map((d) => <div key={d} className="border-b border-r border-blanco-20 bg-blanco-05 px-2 py-1.5 text-center font-mono text-[10px] text-blanco-50">{d}</div>)}
      </div>
      {semanas.map((fila) => <div key={fila[0].fecha} className="grid grid-cols-7 border-l border-blanco-20">
        {fila.map((celda) => {
          const esHoy = celda.fecha === today;
          const fuera = celda.mes !== mesActual.mes && celda.anio === mesActual.anio;
          const esInicio = celda.fecha === GO_LIVE_ISO;
          return <div key={celda.fecha}
            className={`min-h-[4.5rem] border-b border-r border-blanco-20 p-1.5 ${esHoy ? 'bg-blanco-10' : ''}`}>
            <div className="flex items-center justify-between">
              <span className={`font-mono text-xs ${esHoy ? 'bg-blanco px-1.5 py-0.5 font-bold text-negro' : esInicio ? 'text-blanco' : fuera ? 'text-blanco-25' : 'text-blanco-60'}`}>
                {celda.dia}
              </span>
              {esInicio && <span className="font-mono text-[8px] text-blanco-50">GO</span>}
            </div>
            <div className="mt-1 space-y-0.5">
              {celda.hitos.map((hito, i) => <div key={i} className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hito.track === 'dev' ? 'bg-fucsia' : hito.track === 'design' ? 'bg-mostaza' : 'bg-orquidea'}`} />
                <span className="truncate font-mono text-[9px] text-blanco-60">
                  {hito.track === 'dev' ? 'DEV' : hito.track === 'design' ? 'DIS' : 'PAUTA'}
                </span>
              </div>)}
            </div>
          </div>;
        })}
      </div>)}
      <div className="flex flex-wrap items-center gap-4 py-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-blanco-60"><span className="h-1.5 w-1.5 rounded-full bg-fucsia" />DESARROLLO</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-blanco-60"><span className="h-1.5 w-1.5 rounded-full bg-mostaza" />DISEÑO</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-blanco-60"><span className="h-1.5 w-1.5 rounded-full bg-orquidea" />GRADUACIÓN</span>
      </div>
    </div>
  </div>;
}

export function RoadmapView({ today }: { today: string }) {
  const [track, setTrack] = useState<Track>('dev');
  const toGoLive = daysUntil(GO_LIVE_ISO, today);
  const content = contentProgress(today);
  const sesion = currentSession(today);
  const devActivo = devWindows.find((w) => windowState(w, today) === 'en-curso');
  const designActivo = designWindows.find((w) => windowState(w, today) === 'en-curso');

  return <main className="min-h-screen bg-negro">
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">

      <header className="anim-rise mb-8 border-b border-blanco-20 pb-8">
        <p className="eyebrow">[WUNDEER · ROADMAP]</p>
        <h1 className="display-title">La ruta al go-live.</h1>
        <p className="mt-4 text-sm leading-7 text-blanco-70">
          Arranque el <strong className="text-blanco">1 de octubre</strong>, go-live el mismo día, y una sesión de
          graduación al mes. Hoy es {longDate(today)}.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip icon="target" tone="neutro">
            {toGoLive > 0 ? `GO-LIVE EN ${toGoLive} DÍAS` : toGoLive === 0 ? 'GO-LIVE HOY' : `GO-LIVE HACE ${Math.abs(toGoLive)} DÍAS`}
          </Chip>
          <Chip icon="camera" tone="neutro">{content.total} GRADUACIONES MENSUALES</Chip>
          <Chip icon="bolt" tone="neutro">{devWindows.length + designWindows.length} SPRINTS</Chip>
        </div>
      </header>

      <section className="anim-rise mb-8 grid gap-px border border-blanco-20 bg-blanco-10 sm:grid-cols-3" aria-label="Estado de hoy">
        <NowCell icon="bolt" label="DESARROLLO">
          {devActivo ? <><strong className="text-blanco">{devActivo.title.split('·')[1]?.trim() ?? devActivo.title}</strong>
            <span className="mt-1 block font-mono text-[10px] text-blanco-60">{windowGap(devActivo, today)}</span></>
            : <span className="text-blanco-60">SIN SPRINT ABIERTO</span>}
        </NowCell>
        <NowCell icon="scissors" label="DISEÑO">
          {designActivo ? <><strong className="text-blanco">{designActivo.title.split('·')[1]?.trim() ?? designActivo.title}</strong>
            <span className="mt-1 block font-mono text-[10px] text-blanco-60">{windowGap(designActivo, today)}</span></>
            : <span className="text-blanco-60">SIN SPRINT ABIERTO</span>}
        </NowCell>
        <NowCell icon="camera" label="GRADUACIÓN">
          {sesion ? <><strong className="text-blanco">{sesion.theme}</strong>
            <span className="mt-1 block font-mono text-[10px] text-blanco-60">
              {sessionState(sesion, today) === 'cerrado' ? 'MES CERRADO' : `CIERRA EL ${sesion.closeIso.slice(8)}`}
            </span></> : <span className="text-blanco-60">SIN PLAN ACTIVO</span>}
        </NowCell>
      </section>

      <nav className="anim-rise mb-8 grid gap-px border border-blanco-20 bg-blanco-10 sm:grid-cols-3" aria-label="Pistas del roadmap">
        {TRACKS.map((item) => {
          const active = track === item.key;
          return <button key={item.key} onClick={() => setTrack(item.key)} aria-pressed={active}
            className={`group bg-negro p-4 text-left transition-colors ${active ? 'text-blanco' : 'text-blanco-50 hover:bg-blanco-05 hover:text-blanco'}`}>
            <span className="flex items-center gap-2 font-mono text-[10px]">
              <Icon name={item.icon} size={14} />{item.label}
              <span className="ml-auto text-blanco-40">{item.units}</span>
            </span>
            <span className="mt-2 block font-display text-lg font-bold leading-tight">{item.kicker}</span>
          </button>;
        })}
      </nav>

      {/* Calendario: siempre arriba, para que las fechas no dependan de la pista. */}
      <section className="anim-rise mb-8" aria-label="Calendario del roadmap">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-blanco">CALENDARIO</h2>
          <span className="font-mono text-[10px] text-blanco-50">OCT 2026 → {MESES_CORTOS[Number(fin2().slice(5, 7)) - 1]} {fin2().slice(0, 4)}</span>
        </div>
        <Calendario today={today} />
      </section>

      <div key={track} className="view-in">
        {track === 'dev' && <DevTrack today={today} />}
        {track === 'design' && <DesignTrack today={today} />}
        {track === 'content' && <ContentTrack today={today} />}
      </div>
    </div>
  </main>;
}

function fin2(): string {
  return contentRoadmap[contentRoadmap.length - 1].closeIso;
}

function NowCell({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return <div className="bg-negro p-4">
    <p className="mono-label flex items-center gap-2 text-blanco-50"><Icon name={icon} size={13} />{label}</p>
    <p className="mt-2 text-sm leading-6">{children}</p>
  </div>;
}

function MetaGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="grid gap-px border border-blanco-20 bg-blanco-10 sm:grid-cols-2 lg:grid-cols-4">
    {items.map(([label, value]) => <div key={label} className="bg-negro p-4">
      <p className="mono-label text-blanco-50">{label}</p>
      <p className="mt-2 font-mono text-sm leading-6 text-blanco">{value}</p>
    </div>)}
  </div>;
}

function SprintShell({ index, sprint, state, gap, pct, children }: {
  index: number; sprint: { title: string; dates: string; focus: string }; state: WindowState; gap: string; pct: number; children?: React.ReactNode;
}) {
  return <li className={`border bg-negro p-5 sm:p-7 ${state === 'en-curso' ? 'border-blanco-40' : 'border-blanco-20'}`}>
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
    <div className="border-l-4 border-blanco-20 bg-blanco-05 p-5">
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
            <p className="mono-label text-blanco-50">MÓDULOS QUE SE CONSTRUYEN · {sprint.modules.length}</p>
            <ul className="mt-3 space-y-2">{sprint.modules.map((module) => <li key={module} className="border-l-2 border-blanco-20 pl-3 text-sm leading-6 text-blanco-70">{module}</li>)}</ul>
          </div>}
          {sprint.deliverable && <div className="mt-5 border-t border-blanco-20 pt-4">
            <p className="mono-label text-blanco-50">ENTREGABLE DEMO</p>
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
    <div className="border-l-4 border-blanco-20 bg-blanco-05 p-5">
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
            {sprint.days.map((day) => <div key={day.label} className={`border p-4 ${day.urgent ? 'border-blanco-40 bg-blanco-05' : 'border-blanco-20'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="mono-label text-blanco-50">{day.label} · {day.date}</p>
                {day.urgent && <Chip icon="alert" tone="neutro">CLAVE</Chip>}
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
  const mes = currentSession(today);
  return <div className="space-y-6 anim-rise">
    <MetaGrid items={[
      ['CADENCIA', '1 sesión al mes'],
      ['ARRANQUE', contentMeta.start],
      ['ÉNFASIS', 'Pauta publicitaria'],
      ['HORIZONTE', `${contentRoadmap.length} meses`],
    ]} />
    <div className="border-l-4 border-orquidea-40 bg-blanco-05 p-5">
      <p className="eyebrow">CÓMO SE GRADÚA CADA MES</p>
      <p className="mt-3 text-sm leading-7 text-blanco-70">{contentMeta.perSession}.</p>
    </div>
    <ol className="space-y-4">
      {contentRoadmap.map((s) => {
        const state = sessionState(s, today);
        const esHoy = mes?.month === s.month;
        return <li key={s.month} className={`border bg-negro p-5 ${esHoy ? 'border-blanco-40' : 'border-blanco-20'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">{s.monthLabel.toUpperCase()} · SESIÓN {s.monthLabel.toUpperCase()}</p>
              <h2 className="mt-2 font-display text-xl font-bold text-blanco">{s.theme}</h2>
              <p className="mt-2 font-mono text-[10px] text-blanco-60">
                GRADÚA {s.sessionLabel.toUpperCase()} · CIERRA {s.closeIso.slice(8)}/{s.closeIso.slice(5, 7)}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {esHoy && <Chip icon="pin" tone="neutro">ESTE MES</Chip>}
              <Chip tone={TONE[state]}>{STATE_LABEL[state]}</Chip>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-blanco-70">{s.focus}</p>
          <div className="mt-4 flex items-center gap-2 border-t border-blanco-20 pt-3">
            <span className="font-mono text-[10px] text-blanco-50">PIEZAS</span>
            <span className="font-mono text-[10px] text-blanco-80">{s.pieces.length}</span>
            {s.pauta > 0 && <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-blanco-80">
              <span className="h-1.5 w-1.5 rounded-full bg-orquidea" />{s.pauta} DE PAUTA
            </span>}
          </div>
          <ol className="mt-3 space-y-2">
            {s.pieces.map((piece, index) => <li key={piece.topic} className="flex gap-3 border-l-2 border-blanco-20 pl-3">
              <span className="w-6 shrink-0 font-mono text-[10px] text-blanco-50">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <span className={`font-mono text-[10px] uppercase tracking-wide ${piece.pillar === 'PAUTA' ? 'text-orquidea' : 'text-blanco-50'}`}>
                  {PILLAR_LABEL[piece.pillar]}
                </span>
                <p className="text-sm leading-6 text-blanco-70">{piece.topic}</p>
              </div>
            </li>)}
          </ol>
        </li>;
      })}
    </ol>
    <div className="grid gap-px border border-blanco-20 bg-blanco-10 sm:grid-cols-3">
      <div className="bg-negro p-4"><BigCount value={contentProgress(today).done} label="MESES CERRADOS" tone="neutro" /></div>
      <div className="bg-negro p-4"><BigCount value={contentProgress(today).active} label="EN CURSO" tone="neutro" /></div>
      <div className="bg-negro p-4"><BigCount value={contentProgress(today).total} label="EN EL PLAN" /></div>
    </div>
  </div>;
}
