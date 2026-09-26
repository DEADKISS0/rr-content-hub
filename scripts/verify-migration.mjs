// Verificacion estatica de la migracion: comprueba que toda politica creada
// tiene su `to anon`/`to authenticated` explicito y que ninguna escritura
// anonoma sobrevive. Corre con:  node scripts/verify-migration.mjs
import fs from 'fs';

const path = new URL('../supabase/migrations/20260926_close_anon_write.sql', import.meta.url);
const sql = fs.readFileSync(path, 'utf8');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails += 1;
};

// 1. Toda politica creada declara su rol.
const created = [...sql.matchAll(/create policy (\w+)[\s\S]*?;/g)].map(m => m[0]);
check('se crean politicas', created.length > 0, `${created.length} politicas`);
const missingRole = created.filter(p => !/\bto (anon|authenticated)\b/.test(p));
check('toda politica creada declara `to anon` o `to authenticated`', missingRole.length === 0,
  missingRole.length ? `sin rol: ${missingRole.map(p => p.match(/create policy (\w+)/)[1]).join(', ')}` : '');

// 2. Ninguna politica de escritura queda abierta a anon.
const writeForAnon = created.filter(p => /\bto anon\b/.test(p) && /\bfor (insert|update|delete|all)\b/.test(p));
check('ninguna politica de ESCRITURA para anon', writeForAnon.length === 0,
  writeForAnon.length ? writeForAnon.map(p => p.match(/create policy (\w+)/)[1]).join(', ') : '');

// 3. Los 8 drop de escritura anon estan presentes.
const mustDrop = [
  'rr_hub_wundeer_public_ideas_insert', 'rr_hub_wundeer_public_ideas_update',
  'rr_hub_wundeer_public_events_insert', 'rr_hub_wundeer_public_events_update',
  'rr_hub_wundeer_public_comments_insert', 'rr_hub_wundeer_public_comments_update',
  'rr_hub_wundeer_public_assets_insert', 'rr_hub_wundeer_public_assets_update',
];
const missingDrop = mustDrop.filter(p => !new RegExp(`drop policy if exists ${p}\\b`).test(sql));
check('se dropean las 8 politicas de escritura anonima', missingDrop.length === 0,
  missingDrop.length ? `faltan: ${missingDrop.join(', ')}` : '');

// 4. Las `for all` de 20260910 quedan reemplazadas por pares con `to authenticated`.
['rr_hub_ideas_read','rr_hub_ideas_update','rr_hub_ideas_insert',
 'rr_hub_comments_read','rr_hub_comments_insert',
 'rr_hub_events_read','rr_hub_events_insert',
 'rr_hub_assets_read','rr_hub_assets_insert'].forEach(p => {
  check(`se dropea ${p} (era \`for all\` sin to authenticated)`,
    new RegExp(`drop policy if exists ${p}\\b`).test(sql));
});

// 5. La lectura anonima sobrevive.
['rr_hub_wundeer_public_project_read','rr_hub_wundeer_public_ideas_read',
 'rr_hub_wundeer_public_events_read','rr_hub_wundeer_public_comments_read'].forEach(p => {
  check(`la lectura anonima ${p} se mantiene`, new RegExp(`create policy ${p}\\b`).test(sql));
});

// 6. Limpieza: ventana de auditoria y filas de prueba.
check('cierra la ventana de auditoria', /set enabled = false/.test(sql));
check('borra el comentario de prueba', /delete from public\.rr_hub_comments where body = 'probe-hermes'/.test(sql));
check('borra la idea de prueba', /delete from public\.rr_hub_ideas where title = 'RR-AUDIT-PROBE-DELETE-ME'/.test(sql));

// 7. Idempotencia: todo drop es `if exists` y todo create es tras un drop.
const bareDrops = [...sql.matchAll(/drop policy (?!if exists)(\w+)/g)];
check('todo `drop policy` es `if exists`', bareDrops.length === 0, `${bareDrops.length} sin if exists`);

// 8. Sin PII.
check('sin correos reales', !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(sql.replace(/[\w.+-]+@ejemplo\.com/g, '')));

// 9. Balance de parentesis y terminacion. El archivo puede cerrar con un
//    bloque de comentario de verificacion, asi que se ignora el trailing.
const body = sql.replace(/--[^\n]*$/gm, '').trimEnd();
const opens = (body.match(/\(/g) || []).length, closes = (body.match(/\)/g) || []).length;
check('parentesis balanceados', opens === closes, `${opens} abre / ${closes} cierra`);
check('la ultima sentencia termina en punto y coma', /;\s*$/.test(body));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
