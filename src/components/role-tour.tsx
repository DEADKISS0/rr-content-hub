'use client';

import { useEffect, useState } from 'react';
import { useActiveRole } from '@/lib/role-client';
import { roleTour } from '@/lib/onboarding';
import { ROLE_LABEL } from '@/lib/flow';

const SEEN_KEY = 'rr-hub-tour-seen';

/**
 * First-run guided tour. Appears once per role, walks through "who you are",
 * the four flow steps, and the buttons that role will actually use. Different
 * for every role, dismissible, and re-openable from the sidebar.
 */
export function RoleTour() {
  const role = useActiveRole();
  const tour = roleTour(role);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = window.localStorage.getItem(SEEN_KEY);
    window.setTimeout(() => {
      if (seen !== role) { setStep(0); setOpen(true); }
    }, 0);
  }, [role]);

  // Listen for the reopen request emitted by the sidebar "AYUDA" button.
  useEffect(() => {
    const reopen = () => { setStep(0); setOpen(true); };
    window.addEventListener('rr-hub-open-tour', reopen);
    return () => window.removeEventListener('rr-hub-open-tour', reopen);
  }, []);

  const total = tour.steps.length;
  const current = tour.steps[Math.min(step, total - 1)];
  const progress = total > 1 ? ((step + 1) / total) * 100 : 100;

  const close = () => {
    window.localStorage.setItem(SEEN_KEY, role);
    setOpen(false);
  };

  if (!open || !current) return null;

  return <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Guía para ${ROLE_LABEL[role]}`}>
    <button aria-label="Cerrar guía" onClick={close} className="absolute inset-0 bg-negro/80 backdrop-blur-sm" />
    <div className="relative w-full max-w-lg border-2 border-mostaza bg-negro p-6 shadow-brutal-lg anim-pop sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="eyebrow">[GUÍA · {ROLE_LABEL[role]} · {step + 1}/{total}]</p>
        <button onClick={close} className="font-mono text-xs text-blanco-40 hover:text-blanco">SALTAR ×</button>
      </div>

      <div className="mb-6 h-1 w-full bg-blanco-10">
        <div className="h-1 bg-mostaza transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="min-h-[220px]">
        <p className="mono-label text-fucsia">{current.kicker}</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-blanco sm:text-4xl">{current.title}</h2>
        <p className="mt-4 text-sm leading-7 text-blanco-60">{current.body}</p>
        <ul className="mt-5 space-y-2 border-t border-blanco-10 pt-4">
          {current.bullets.map((bullet) => <li key={bullet} className="font-mono text-[11px] leading-5 text-blanco-60">{bullet}</li>)}
        </ul>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="border-2 border-blanco-20 px-4 py-2 font-mono text-[10px] text-blanco-60 disabled:opacity-30 hover:border-blanco">← ATRÁS</button>
        {step < total - 1
          ? <button onClick={() => setStep((s) => s + 1)} className="btn-brutal">SIGUIENTE →</button>
          : <button onClick={close} className="btn-brutal-mostaza">ENTENDIDO · EMPEZAR →</button>}
      </div>
    </div>
  </div>;
}
