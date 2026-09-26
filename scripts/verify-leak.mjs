// Inventario de la fuga de datos que NO depende de que nadie aplique una
// migracion. Se ejecuta contra produccion con la publishable key — la misma
// que va en el bundle del navegador, es decir, la que tiene cualquier visitante
// de Wundeer. Todo lo que responda 200 aqui es un fallo.
//
//   npm run verify:leak        (solo lectura: un GET por tabla, nunca un write)
//
// Este script no muta nada a proposito. Las dos filas de prueba que dejo una
// auditoria anterior se limpiaron con la migracion, no desde aqui.
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga .env.local a mano en lugar de depender de `--env-file`: el script debe
// funcionar con `node scripts/verify-leak.mjs` y con npm, sin Recordar flags.
const envPath = path.join(repoRoot, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'https://ntgtvtzbjwotuwkiflar.supabase.co';
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Un .env.local de desarrollo apunta a localhost, y contra el stack local todo
// responde 200 por los defaults del propio emulador: la comprobacion pasaria sin
// haber mirado produccion. Este script verifica produccion o no verifica nada,
// asi que si la URL no es la pública, se detiene.
const PRODUCTION_HOST = 'ntgtvtzbjwotuwkiflar.supabase.co';
if (!url.includes(PRODUCTION_HOST)) {
  console.error(`Este script solo verifica produccion (${PRODUCTION_HOST}).`);
  console.error(`La URL configurada es ${url} — parece el stack local.`);
  console.error('Para auditar produccion:  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co node scripts/verify-leak.mjs');
  process.exit(2);
}

// Tablas que el hub necesita publicas: Wundeer es legible sin sesion.
const MUST_BE_PUBLIC = [
  'rr_hub_ideas', 'rr_hub_projects', 'rr_hub_comments', 'rr_hub_events', 'rr_hub_assets',
];

// Tablas que NUNCA deben ser publicas. Son de un CRM compartido que quedo
// huerfano en este proyecto de Supabase: correos, nombres y pipeline comercial.
const MUST_BE_PRIVATE = ['profiles', 'projects'];

if (!anonKey) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY. No se puede verificar.');
  process.exit(2);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
let leaks = 0;

/**
 * `select` on a table is the exact test, but the failure modes must be kept
 * apart. A missing table (PGRST205) and a permission error (42501) both mean
 * "not readable", which is the state we want. A network error or a bad key
 * means the probe never ran, and calling that "private" would be a false
 * all-clear — so it reports as unknown and fails the run.
 */
const readable = async (table) => {
  const { data, error, status } = await supabase.from(table).select('*').limit(1);
  if (error) {
    const missing = error.code === 'PGRST205' || /not exist/i.test(error.message);
    const denied = error.code === '42501' || /permission|row-level/i.test(error.message);
    if (missing || denied) return { ok: false, status: missing ? 'no existe' : 'sin permiso' };
    return { ok: false, unknown: true, status: `${error.code}: ${error.message}` };
  }
  return { ok: true, status: status ?? 200, sample: data?.[0] };
};

console.log(`Probando como anonimo contra ${url}\n`);
console.log('Deben ser PUBLICAS (Wundeer se lee sin sesion):');
let unknown = 0;
for (const table of MUST_BE_PUBLIC) {
  const r = await readable(table);
  if (r.ok) { console.log(`  ok   ${table}`); continue; }
  if (r.unknown) { unknown += 1; console.log(`  ??   ${table} — no se pudo comprobar: ${r.status}`); continue; }
  console.log(`  AVISO ${table} — ${r.status}. Wundeer tiene que ser legible sin sesion.`);
}

console.log('\nDeben ser PRIVADAS (CRM huerfano, sin consumidores):');
for (const table of MUST_BE_PRIVATE) {
  const r = await readable(table);
  if (r.ok) {
    leaks += 1;
    console.log(`  FUGA ${table} — legible sin sesion (${r.status})`);
    if (r.sample) console.log(`        campos expuestos: ${Object.keys(r.sample).join(', ')}`);
  } else if (r.unknown) {
    unknown += 1;
    console.log(`  ??   ${table} — no se pudo comprobar: ${r.status}`);
  } else {
    console.log(`  ok   ${table} — ${r.status}`);
  }
}

if (unknown > 0) {
  console.log(`\n${unknown} comprobacion(es) sin resultado: la sonda no llego a ejecutarse.`);
  console.log('Un "todo bien" aqui seria falso. Revisar la URL y la anon key.');
  process.exit(2);
}
if (leaks > 0) {
  console.log(`\n${leaks} tabla(s) del CRM siguen publicas. Aplicar supabase/migrations/20260927_crm_public_read_lockdown.sql`);
  process.exit(1);
}
console.log('\nTODO OK — ninguna tabla del CRM es legible sin sesion');
