// Verificacion de las funciones de roadmap anadidas. Corre con:
//   node --experimental-strip-types scripts/verify-roadmap.mts
//
// Reescrito el 2026-09-29 con el cambio de cadencia: el plan paso de 22 semanas
// con 5 entregas a UNA sesion de graduacion al mes, y arranca el 1 de octubre.
// Este archivo era el que rompia el CI: importaba `isRoadmapStale` y
// `roadmapWeekNumber`, que ya no existen porque la cadencia cambio.
import {
  contentRoadmap, currentSession, sessionState, contentProgress,
  PILLAR_LABEL, ROADMAP_START_ISO, devWindows, designWindows, daysBetween,
} from '../src/lib/roadmap.ts';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails += 1;
};

check('el plan tiene sesiones', contentRoadmap.length > 0, `${contentRoadmap.length} meses`);
check('la primera sesion es la fecha declarada', contentRoadmap[0].sessionIso === ROADMAP_START_ISO, `${contentRoadmap[0].sessionIso}`);
check('el arranque es el 1 de octubre', ROADMAP_START_ISO === '2026-10-01', ROADMAP_START_ISO);
check('cada mes tiene tema', contentRoadmap.every(s => s.theme.length > 0));
check('cada sesion cierra dentro de su mes', contentRoadmap.every(s => s.closeIso.slice(0, 7) === s.sessionIso.slice(0, 7)));
check('cada sesion cierra despues de abrir', contentRoadmap.every(s => s.closeIso >= s.sessionIso));
check('cada mes trae piezas', contentRoadmap.every(s => s.pieces.length >= 4));
check('los pilares de las piezas existen en la etiqueta', contentRoadmap.every(
  s => s.pieces.every(p => Boolean(PILLAR_LABEL[p.pillar])),
));
check('octubre lleva enfasis en pauta', contentRoadmap[0].pauta >= 3, `${contentRoadmap[0].pauta} de pauta`);
check('ningun tramo arranca antes del 1 de octubre', [...devWindows, ...designWindows].every(w => w.startIso >= ROADMAP_START_ISO));
check('ningun tramo esta al reves', [...devWindows, ...designWindows].every(w => daysBetween(w.startIso, w.endIso) > 0));

// Estado: antes de arrancar nada esta pendiente; durante el mes 1 esta en curso.
check('antes de arrancar no hay mes cerrado', contentProgress('2026-09-26').done === 0);
check('el 1 de octubre la sesion 1 esta en curso', sessionState(contentRoadmap[0], ROADMAP_START_ISO) === 'en-curso');
check('cerrado octubre, la sesion que toca es la 2', currentSession('2026-11-02')?.month === 2);
check('octubre cerrado suma 1 al progreso', contentProgress('2026-11-02').done === 1);

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
