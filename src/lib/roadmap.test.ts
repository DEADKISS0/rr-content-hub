import { describe, expect, it } from 'vitest';
import {
  GO_LIVE_ISO, contentProgress, contentRoadmap, currentWeek, designWindows, devWindows,
  daysBetween, daysUntil, pendingDeliveries, progressPct, weekState, windowGap, windowState,
} from './roadmap';

/**
 * El roadmap tiene que saber en qué punto está el plan.
 *
 * Fechas fijas a propósito: los casos usan el día de corte real (2026-09-26) y
 * nunca `new Date()`, para que el test no cambie de resultado con el calendario.
 */
const HOY = '2026-09-26';

describe('cuentas de días', () => {
  it('cuenta días entre dos fechas ISO', () => {
    expect(daysBetween('2026-09-26', '2026-10-01')).toBe(5);
    expect(daysBetween('2026-09-08', '2026-09-26')).toBe(18);
    expect(daysBetween('2026-09-26', '2026-09-26')).toBe(0);
    expect(daysBetween('2026-10-01', '2026-09-26')).toBe(-5);
  });

  it('dice cuántos días faltan para el go-live', () => {
    expect(daysUntil(GO_LIVE_ISO, HOY)).toBe(5);
    expect(daysUntil(GO_LIVE_ISO, GO_LIVE_ISO)).toBe(0);
  });
});

describe('avance de un tramo', () => {
  it('arranca en 0 y termina en 100', () => {
    expect(progressPct('2026-09-08', '2026-09-26', '2026-09-08')).toBe(0);
    expect(progressPct('2026-09-08', '2026-09-26', '2026-09-26')).toBe(100);
  });

  it('no se sale del rango aunque la fecha esté fuera', () => {
    expect(progressPct('2026-09-08', '2026-09-26', '2026-01-01')).toBe(0);
    expect(progressPct('2026-09-08', '2026-09-26', '2027-01-01')).toBe(100);
  });

  it('un tramo sin duración no divide por cero', () => {
    expect(progressPct('2026-09-26', '2026-09-26', '2026-09-26')).toBe(100);
  });
});

describe('estado de cada tramo', () => {
  it('marca cerrado, en curso y pendiente', () => {
    expect(windowState(devWindows[0], HOY)).toBe('cerrado');   // 08–12 SEP
    expect(windowState(devWindows[1], HOY)).toBe('en-curso');   // 15–26 SEP
    expect(windowState(devWindows[2], HOY)).toBe('en-curso');   // 22 SEP – 01 OCT
    expect(windowState({ title: 'futuro', startIso: '2026-11-01', endIso: '2026-11-10' }, HOY)).toBe('pendiente');
  });

  it('lo dice en palabras, con el día dentro del tramo', () => {
    expect(windowGap(devWindows[0], HOY)).toBe('CERRADO HACE 14 DÍAS');
    expect(windowGap(devWindows[1], HOY)).toBe('DÍA 12 DE 12');
    expect(windowGap({ title: 'futuro', startIso: '2026-10-05', endIso: '2026-10-10' }, HOY)).toBe('ABRE EN 9 DÍAS');
  });

  it('las ventanas del plan son coherentes (inicio antes que fin)', () => {
    for (const window of [...devWindows, ...designWindows]) {
      expect(daysBetween(window.startIso, window.endIso), `${window.title} al revés`).toBeGreaterThan(0);
    }
  });
});

describe('plan de contenido', () => {
  it('la semana de hoy está en curso y tiene entregas pendientes', () => {
    const semana = currentWeek(HOY);
    expect(semana).toBeTruthy();
    expect(weekState(semana!, HOY)).toBe('en-curso');
    expect(pendingDeliveries(semana!, HOY)).toBeGreaterThan(0);
  });

  it('el progreso cuenta semanas cerradas y en curso sin pasarse del total', () => {
    const progreso = contentProgress(HOY);
    expect(progreso.done + progreso.active).toBeLessThanOrEqual(progreso.total);
    expect(progreso.total).toBe(contentRoadmap.length);
    expect(progreso.done).toBe(2); // semanas 1 y 2 cerradas al 26 SEP
  });

  it('antes de arrancar el plan no hay ninguna semana cerrada', () => {
    expect(contentProgress('2026-09-01').done).toBe(0);
    expect(contentProgress('2026-09-01').active).toBe(0);
  });
});
