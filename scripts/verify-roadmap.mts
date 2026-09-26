// Verificacion de las funciones de roadmap anadidas. Corre con:
//   node --experimental-strip-types scripts/verify-roadmap.mts
import { contentRoadmap, isRoadmapStale, roadmapWeekNumber, ROADMAP_START_ISO } from '../src/lib/roadmap.ts';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails += 1;
};

check('el plan tiene semanas', contentRoadmap.length > 0, `${contentRoadmap.length} semanas`);
check('la primera sesion es la fecha declarada', contentRoadmap[0].sessionIso === ROADMAP_START_ISO, `${contentRoadmap[0].sessionIso}`);
check('cada semana entrega 1..5 piezas', contentRoadmap.every(w => w.deliveries.length === 5));
check('cada semana tiene tema', contentRoadmap.every(w => w.theme.length > 0));
check('las fechas de entrega caen tras la sesion', contentRoadmap.every(w => w.deliveries.every(d => d.iso >= w.sessionIso)));

// isRoadmapStale: antes de la ultima sesion => vigente; despues => caducado.
const lastSession = `${contentRoadmap.at(-1)!.sessionIso}T23:59:59`;
check('el plan NO es caduco antes de terminar', isRoadmapStale(new Date(contentRoadmap[0].sessionIso)) === false);
check('el plan ES caduco un dia despues de la ultima sesion', isRoadmapStale(new Date(Date.parse(lastSession) + 86_400_000)) === true);

// roadmapWeekNumber: semana 1 al arrancar, y se detiene en el total.
check('semana 1 en la fecha de arranque', roadmapWeekNumber(new Date(ROADMAP_START_ISO)) === 1, String(roadmapWeekNumber(new Date(ROADMAP_START_ISO))));
check('semana 1 antes de arrancar (nunca 0 ni negativo)', roadmapWeekNumber(new Date('2020-01-01')) === 1);
check('se detiene en el total de semanas', roadmapWeekNumber(new Date('2030-01-01')) === contentRoadmap.length, String(roadmapWeekNumber(new Date('2030-01-01'))));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
