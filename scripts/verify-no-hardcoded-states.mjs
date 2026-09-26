// Detecta listas de estados escritas a mano fuera del motor. Ese patron fue la
// causa de todas las desviaciones: las cuatro paginas de cola, el tablero de
// cuatro columnas y el filtro del banco tenían cada una su propia copia, y
// ninguna coincidia con las demás. `flow.ts` y `queues.ts` son la excepción.
//   node scripts/verify-no-hardcoded-states.mjs
import fs from 'fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ALLOWED = new Set(['src/lib/flow.ts', 'src/lib/queues.ts', 'src/lib/demo-data.ts']);

// Cualquier estado del dominio es un string literal de esta lista.
const STATES = [
  'draft', 'pending_approval', 'needs_changes', 'approved',
  'script_in_progress', 'pending_script_review', 'script_approved',
  'in_production', 'raw_uploaded', 'editing', 'ready_to_publish',
  'published', 'closed',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(path.join(repoRoot, 'src'))) {
  const rel = path.relative(repoRoot, file);
  if (ALLOWED.has(rel)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Una lista de estados es un array con >=2 estados, no un uso suelto.
    const found = STATES.filter((s) => line.includes(`'${s}'`) || line.includes(`"${s}"`));
    if (found.length >= 2) {
      offenders.push({ rel, line: i + 1, found, text: line.trim().slice(0, 110) });
    }
  });
}

if (offenders.length === 0) {
  console.log('PASS  ninguna lista de estados escrita a mano fuera de flow.ts / queues.ts');
  console.log('\nTODO OK');
  process.exit(0);
}

console.log(`FAIL  ${offenders.length} lista(s) de estados escrita(s) a mano:\n`);
for (const o of offenders) {
  console.log(`  ${o.rel}:${o.line}`);
  console.log(`    ${o.text}`);
  console.log(`    → ${o.found.join(', ')}\n`);
}
console.log('Cada lista debe salir de QUEUES (src/lib/queues.ts), que a su vez deriva de flow.ts.');
process.exit(1);
