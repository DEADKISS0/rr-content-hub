import { describe, expect, it } from 'vitest';
import {
  GO_LIVE_ISO, ROADMAP_START_ISO, contentProgress, contentRoadmap, currentSession, designWindows, devWindows,
  daysBetween, daysUntil, progressPct, sessionState, windowGap, windowState,
} from './roadmap';

/**
 * El roadmap tiene que saber en qué punto está el plan.
 *
 * Fechas fijas a propósito: los casos usan un día de corte explícito y nunca
 * `new Date()`, para que el test no cambie de resultado con el calendario.
 *
 * El cambio de 2026-09-29 movió el arranque al 1 de octubre y pasó la cadencia
 * de semanal a una sesión de graduación al mes, así que `HOY` es el 26 de
 * septiembre: el día antes de arrancar. Con esa fecha los tramos de desarrollo
 * y diseño tienen que estar todos pendientes, que es lo correcto: nada empieza
 * antes del 1 de octubre.
 */
const HOY_ANTES = '2026-09-26';
const HOY_ARRANQUE = '2026-10-01';

describe('cuentas de días', () => {
  it('cuenta días entre dos fechas ISO', () => {
    expect(daysBetween('2026-09-26', '2026-10-01')).toBe(5);
    expect(daysBetween('2026-10-01', '2026-10-26')).toBe(25);
    expect(daysBetween('2026-09-26', '2026-09-26')).toBe(0);
    expect(daysBetween('2026-10-01', '2026-09-26')).toBe(-5);
  });

  it('dice cuántos días faltan para el go-live', () => {
    expect(daysUntil(GO_LIVE_ISO, HOY_ANTES)).toBe(5);
    expect(daysUntil(GO_LIVE_ISO, GO_LIVE_ISO)).toBe(0);
  });
});

describe('arranque en el 1 de octubre', () => {
  it('el go-live y el arranque son el mismo día', () => {
    expect(ROADMAP_START_ISO).toBe('2026-10-01');
    expect(GO_LIVE_ISO).toBe(ROADMAP_START_ISO);
  });

  it('ningún tramo empieza antes del arranque', () => {
    for (const window of [...devWindows, ...designWindows]) {
      expect(window.startIso >= ROADMAP_START_ISO, `${window.title} arranca antes`).toBe(true);
    }
  });

  it('antes del 1 de octubre todo está pendiente, nada en curso', () => {
    for (const window of [...devWindows, ...designWindows]) {
      expect(windowState(window, HOY_ANTES), `${window.title}`).toBe('pendiente');
    }
    expect(contentProgress(HOY_ANTES).done).toBe(0);
    expect(contentProgress(HOY_ANTES).active).toBe(0);
  });

  it('el 1 de octubre el primer sprint ya está en curso', () => {
    expect(windowState(devWindows[0], HOY_ARRANQUE)).toBe('en-curso');
    expect(windowGap(devWindows[0], HOY_ARRANQUE)).toBe('DÍA 1 DE 9');
  });
});

describe('avance de un tramo', () => {
  it('arranca en 0 y termina en 100', () => {
    expect(progressPct('2026-10-01', '2026-10-09', '2026-10-01')).toBe(0);
    expect(progressPct('2026-10-01', '2026-10-09', '2026-10-09')).toBe(100);
  });

  it('no se sale del rango aunque la fecha esté fuera', () => {
    expect(progressPct('2026-10-01', '2026-10-09', '2026-01-01')).toBe(0);
    expect(progressPct('2026-10-01', '2026-10-09', '2027-01-01')).toBe(100);
  });

  it('un tramo sin duración no divide por cero', () => {
    expect(progressPct('2026-10-01', '2026-10-01', '2026-10-01')).toBe(100);
  });
});

describe('estado de cada tramo', () => {
  it('marca cerrado, en curso y pendiente', () => {
    expect(windowState(devWindows[0], '2026-10-10')).toBe('cerrado');
    expect(windowState(devWindows[0], '2026-10-05')).toBe('en-curso');
    expect(windowState(devWindows[0], '2026-10-09')).toBe('en-curso'); // el último día sigue abierto
    expect(windowState({ title: 'futuro', startIso: '2027-01-01', endIso: '2027-01-10' }, HOY_ARRANQUE)).toBe('pendiente');
  });

  it('lo dice en palabras, con el día dentro del tramo', () => {
    expect(windowGap(devWindows[0], '2026-10-20')).toBe('CERRADO HACE 11 DÍAS');
    expect(windowGap(devWindows[0], HOY_ARRANQUE)).toBe('DÍA 1 DE 9');
    expect(windowGap({ title: 'futuro', startIso: '2026-10-05', endIso: '2026-10-10' }, HOY_ARRANQUE)).toBe('ABRE EN 4 DÍAS');
  });

  it('las ventanas del plan son coherentes (inicio antes que fin)', () => {
    for (const window of [...devWindows, ...designWindows]) {
      expect(daysBetween(window.startIso, window.endIso), `${window.title} al revés`).toBeGreaterThan(0);
    }
  });
});

describe('una sesión de graduación al mes', () => {
  it('hay cinco sesiones, una por mes, sin repeticiones', () => {
    expect(contentRoadmap.length).toBe(5);
    const etiquetas = contentRoadmap.map((s) => s.monthLabel);
    expect(new Set(etiquetas).size).toBe(5);
  });

  it('la primera sesión es el 1 de octubre de 2026', () => {
    const primera = contentRoadmap[0];
    expect(primera.sessionIso).toBe('2026-10-01');
    expect(primera.monthLabel).toBe('octubre 2026');
    expect(primera.closeIso).toBe('2026-10-31');
  });

  it('cada sesión cae dentro de su propio mes y cierra en el último día', () => {
    for (const sesion of contentRoadmap) {
      const mes = sesion.sessionIso.slice(5, 7);
      expect(sesion.sessionIso.slice(0, 7), `${sesion.monthLabel} se salió de su mes`).toBe(sesion.closeIso.slice(0, 7));
      expect(mes, `${sesion.monthLabel}`).toBe(sesion.closeIso.slice(5, 7));
      expect(sesion.sessionIso <= sesion.closeIso, `${sesion.monthLabel} cierra antes de abrir`).toBe(true);
    }
  });

  it('los meses son consecutivos, sin saltos', () => {
    for (let i = 1; i < contentRoadmap.length; i += 1) {
      const previo = contentRoadmap[i - 1].closeIso;
      const actual = contentRoadmap[i].sessionIso;
      expect(actual > previo, `${contentRoadmap[i].monthLabel} no sigue a ${contentRoadmap[i - 1].monthLabel}`).toBe(true);
      expect(daysBetween(previo, actual), `${contentRoadmap[i].monthLabel} deja un hueco`).toBeLessThanOrEqual(7);
    }
  });

  it('octubre lleva énfasis en pauta, y el resto también tiene de qué hablar', () => {
    const octubre = contentRoadmap[0];
    expect(octubre.theme.startsWith('PAUTA')).toBe(true);
    expect(octubre.pauta).toBeGreaterThanOrEqual(3);
    expect(octubre.pieces.length).toBe(6);
  });

  it('el estado de la sesión depende de si ya cerró el mes', () => {
    const octubre = contentRoadmap[0];
    expect(sessionState(octubre, HOY_ANTES)).toBe('pendiente');
    expect(sessionState(octubre, '2026-10-15')).toBe('en-curso');
    expect(sessionState(octubre, '2026-11-02')).toBe('cerrado');
  });

  it('la sesión que toca es la abierta, y el progreso cuadra', () => {
    const sesion = currentSession(HOY_ARRANQUE);
    expect(sesion?.month).toBe(1);
    expect(sessionState(sesion!, HOY_ARRANQUE)).toBe('en-curso');

    const progreso = contentProgress(HOY_ARRANQUE);
    expect(progreso.done).toBe(0);
    expect(progreso.active).toBe(1);
    expect(progreso.total).toBe(contentRoadmap.length);
    expect(progreso.done + progreso.active).toBeLessThanOrEqual(progreso.total);
  });

  it('cerrado octubre, el progreso suma uno y la sesión que toca es noviembre', () => {
    const progreso = contentProgress('2026-11-02');
    expect(progreso.done).toBe(1);
    expect(currentSession('2026-11-02')?.month).toBe(2);
  });
});
