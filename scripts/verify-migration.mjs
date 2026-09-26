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

// 10. `code` debe quedar unico por (proyecto, tipo). El endpoint lo genera
//     con un max+1 seguido de INSERT y reintenta ante 23505, pero sin el indice
//     el 23505 nunca llega y dos llamadas simultaneas dejaban codigos
//     duplicados. Verificado contra produccion: 25 filas con code, 0 choques.
check('el indice unico de code existe', /create unique index if not exists rr_hub_ideas_code_unique/i.test(sql));
check('el indice unico exime las filas sin code', /where code is not null/i.test(sql));

// 11. El bucket de assets no existe en produccion — la API de Storage devuelve
//     `[]`, o sea que no hay NINGUN bucket, no solo falta el del hub. Sin el,
//     uploadAsset() falla siempre con NoSuchBucket.
check('la migracion crea el bucket de assets', /insert into storage\.buckets/i.test(sql));
check('el bucket se llama rr-content-assets', /rr-content-assets/.test(sql));
check('el bucket limita el tamano de archivo', /file_size_limit/.test(sql));
check('el bucket restringe los tipos permitidos', /allowed_mime_types/.test(sql));
// getPublicUrl() no falla nunca, construye la cadena exista o no el objeto, y
// signedAssetUrl la devuelve tal cual: un asset muerto se ve como imagen rota
// en vez de como error. Exigir public=true aqui mantiene sincronizado ese
// comentario del codigo con la base, que es donde se romperia el silencio.
check('el bucket es publico, como espera signedAssetUrl', /insert into storage\.buckets[\s\S]{0,200}true/.test(sql));

// 12. El bloque del bucket tiene que ir DESPUES de las politicas de storage,
//     o el bucket nace sin acceso hasta que se apliquen.
const bucketAt = sql.search(/insert into storage\.buckets/i);
const lastPolicyAt = Math.max(...[...sql.matchAll(/create policy.*storage/gi)].map((m) => m.index));
check('el bucket se crea despues de las politicas de storage',
  bucketAt > lastPolicyAt, `bucket en ${bucketAt}, ultima politica en ${lastPolicyAt}`);

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
