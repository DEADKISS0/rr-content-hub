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

// Tablas del HUB que deben seguir CERRADAS al anonimo.
//
// OJO, esto cambio el 2026-09-30 y el script decia lo contrario. Antes decia
// "Deben ser PUBLICAS: Wundeer es legible sin sesion", y de verdad lo decia con
// un AVISO por cada tabla que fallaba — y luego terminaba en `TODO OK`. Una
// contradiccion asi no vigila nada: hay que saber que se quiere, no lo que hayo
// por costumbre.
//
// MEDIDO: el hub esta CERRADO. Las policies `rr_hub_wundeer_public_*` existen en
// `pg_policies` para el rol `anon`, pero al `anon` le falta el `GRANT SELECT`, asi
// que la respuesta real es `permission denied`. Las policies existen como resto
// de una configuracion anterior; lo que decide es el grant.
const MUST_BE_PRIVATE_HUB = [
  'rr_hub_ideas', 'rr_hub_projects', 'rr_hub_comments', 'rr_hub_events', 'rr_hub_assets',
];

// Tablas que NUNCA deben ser publicas.
//
// ESTA LISTA ESTABA MAL Y POR ESO NO DETECTABA NADA (medido el 2026-09-30).
// Decia `['profiles', 'projects']`, que NO son las tablas del CRM huerfano: al
// preguntar por nombres que no existen, el check pasaba sin haber medido nada.
// Un verificador que mira las tablas equivocadas da una confianza falsa, que es
// peor que no tener ninguno.
//
// Las reales, con `anon=arwdDxtm` en `relacl` y policies `cmd = ALL`:
//   prospects            22 filas, 29 columnas: telefono, WhatsApp, correo
//   outreach_sequences   63 filas, secuencias de contacto comercial
//   knowledge            21 filas, incluye "Servicios y precios"
//   demos                17 filas
//   activities            2 filas
// `verticals` tambien es anon y se deja: son nombres de sector, no datos de
// contacto, y hay codigo que la lee. Si algun dia se cierra, se comprueba aqui.
const MUST_BE_PRIVATE = [
  'prospects', 'activities', 'knowledge', 'outreach_sequences', 'demos',
];

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
console.log('Deben estar CERRADAS al anonimo (el hub usa cookie, no anon):');
let unknown = 0;
for (const table of MUST_BE_PRIVATE_HUB) {
  const r = await readable(table);
  // OJO CON EL SENTIDO, que se dio la vuelta una vez: `readable()` devuelve
  // `ok: true` cuando SI se lee. Aqui lo que se quiere es que NO se lea, asi que
  // lo bueno es `ok: false`. La version anterior de este bloque decia lo
  // contrario y reportaba FUGA donde no habia ninguna.
  if (r.ok) {
    // FUGA REAL: una tabla del hub legible sin sesion significa briefs,
    // referencias, credenciales de cliente y votos expuestos a cualquiera.
    leaks += 1;
    console.log(`  FUGA ${table} — legible sin sesion (${r.status})`);
    if (r.sample) console.log(`        campos expuestos: ${Object.keys(r.sample).join(', ')}`);
    continue;
  }
  if (r.unknown) {
    // No se pudo comprobar. Eso NO es una buena noticia: contarlo como cerrada
    // seria un all-clear falso. Se avisa y la corrida falla.
    unknown += 1;
    console.log(`  ??   ${table} — no se pudo comprobar: ${r.status}`);
    continue;
  }
  console.log(`  ok   ${table} — ${r.status}`);
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
  console.log(`\n${leaks} tabla(s) del CRM siguen publicas.`);
  console.log('Cerrar con supabase/migrations/20260930_crm_anon_lockdown.sql');
  console.log('(la 20260927 solo cierra `profiles` y `projects`, que son de otro producto;');
  console.log(' estas seis no estaban en su lista)');
  process.exit(1);
}

console.log('\nTODO OK — ninguna tabla del CRM es legible sin sesion');
