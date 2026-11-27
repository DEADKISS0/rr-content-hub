/**
 * Levanta Postgres + PostgREST + un puente de auth local y corre el E2E.
 * No habla con el proyecto de produccion. La contrasena y los JWT se generan
 * en /tmp y no se escriben en el repo.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

const RAIZ = new URL('..', import.meta.url).pathname;
const PASS = randomBytes(18).toString('hex');
const SECRETO = randomBytes(32).toString('hex');
const HUB_SECRET = randomBytes(32).toString('hex');
const PUERTO_REST = 54322;
const PUERTO_APP = 54321;
const PUERTO_NEXT = 3100;
const ORIGEN_NEXT = `http://localhost:${PUERTO_NEXT}`;

function psql(sql, db = 'postgres') {
  return execFileSync('sudo', ['-u', 'postgres', 'psql', '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
  });
}

function jwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    role,
    iss: 'supabase-local',
    iat: 1700000000,
    exp: 2000000000,
  })).toString('base64url');
  const sig = createHmac('sha256', SECRETO).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function sqlValor(valor) {
  return `'${String(valor).replace(/'/g, "''")}'`;
}

execFileSync('bash', ['-lc', 'pkill -f "[n]ext dev --port 3100" || true; pkill -f "[n]ext-server" || true; pkill -f "[p]ostgrest" || true; sleep 0.6']);

psql(`
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
alter role service_role bypassrls;
do $$ begin
  create role authenticator noinherit login password '${PASS}';
exception when duplicate_object then
  alter role authenticator with login password '${PASS}';
end $$;
grant anon, authenticated, service_role to authenticator;
`);
psql('drop database if exists hub_e2e;');
psql('create database hub_e2e;');
execFileSync('sudo', ['-u', 'postgres', 'psql', '-d', 'hub_e2e', '-v', 'ON_ERROR_STOP=1', '-f', `${RAIZ}e2e/schema/prod-local.sql`], { stdio: 'inherit' });
execFileSync('sudo', ['-u', 'postgres', 'psql', '-d', 'hub_e2e', '-v', 'ON_ERROR_STOP=1', '-f', `${RAIZ}e2e/schema/seed.sql`], { stdio: 'inherit' });

const servicio = jwt('service_role');
const anon = jwt('anon');
const envRest = {
  ...process.env,
  PGRST_DB_URI: `postgresql://authenticator:${PASS}@127.0.0.1:5432/hub_e2e`,
  PGRST_DB_SCHEMAS: 'public',
  PGRST_DB_ANON_ROLE: 'anon',
  PGRST_JWT_SECRET: SECRETO,
  PGRST_SERVER_PORT: String(PUERTO_REST),
};
const rest = spawn('/tmp/bin/postgrest', [], { env: envRest, stdio: ['ignore', 'pipe', 'pipe'] });
rest.stderr.on('data', (b) => process.stderr.write(b));

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', reject);
  });
}

const puente = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/auth/v1/admin/users') {
      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${servicio}`) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ msg: 'no autorizado' }));
        return;
      }
      const cuerpo = JSON.parse(await leerCuerpo(req) || '{}');
      if (cuerpo.email_confirm !== true) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ msg: 'el alta local exige email_confirm' }));
        return;
      }
      const nombre = cuerpo.user_metadata?.full_name ?? cuerpo.email;
      const meta = JSON.stringify({ full_name: nombre });
      try {
        const fila = execFileSync('sudo', ['-u', 'postgres', 'psql', '-d', 'hub_e2e', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c',
          `insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
           values (gen_random_uuid(), ${sqlValor(String(cuerpo.email).toLowerCase())}, ${sqlValor(randomBytes(16).toString('hex'))}, now(), ${sqlValor(meta)}::jsonb)
           returning id || '|' || email`], { encoding: 'utf8' }).trim();
        const [id, email] = fila.split('|');
        const ahora = new Date().toISOString();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id, email, aud: 'authenticated', role: 'authenticated',
          email_confirmed_at: ahora, created_at: ahora, updated_at: ahora,
          user_metadata: { full_name: nombre },
          app_metadata: { provider: 'email', providers: ['email'] },
          is_anonymous: false,
        }));
      } catch (error) {
        const texto = String(error.stderr || error.message || error);
        const ya = /duplicate key|already exists/i.test(texto);
        res.writeHead(ya ? 422 : 500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ msg: ya ? 'A user with this email address has already been registered' : 'alta local fallida', code: ya ? 'email_exists' : 'unexpected' }));
      }
      return;
    }

    if (url.pathname.startsWith('/rest/v1')) {
      const destino = httpRequest({
        hostname: '127.0.0.1',
        port: PUERTO_REST,
        path: `${url.pathname.slice('/rest/v1'.length) || '/'}${url.search}`,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${PUERTO_REST}` },
      }, (upstream) => {
        res.writeHead(upstream.statusCode ?? 500, upstream.headers);
        upstream.pipe(res);
      });
      req.pipe(destino);
      destino.on('error', () => {
        res.writeHead(502);
        res.end('postgrest');
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ msg: 'no' }));
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ msg: String(error.message ?? error) }));
  }
});

await new Promise((resolve) => puente.listen(PUERTO_APP, '127.0.0.1', resolve));

const envNext = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PUERTO_APP}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: servicio,
  HUB_SECRET,
  NEXT_PUBLIC_HUB_DEMO: '',
};
const next = spawn('npm', ['run', 'dev', '--', '--port', String(PUERTO_NEXT)], {
  cwd: RAIZ,
  env: envNext,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
next.stdout.on('data', (b) => process.stdout.write(b));
next.stderr.on('data', (b) => process.stderr.write(b));

let listo = false;
for (let i = 0; i < 60; i += 1) {
  try {
    const respuesta = await fetch(`http://127.0.0.1:${PUERTO_NEXT}/wundeer`);
    if (respuesta.status < 500) { listo = true; break; }
  } catch { /* todavia arranca */ }
  await wait(1000);
}
function matar(hijo) {
  try { process.kill(-hijo.pid, 'SIGTERM'); } catch { try { hijo.kill('SIGTERM'); } catch { /* ya termino */ } }
}

if (!listo) {
  matar(next);
  rest.kill('SIGTERM');
  puente.close();
  throw new Error('el hub local no abrio /wundeer');
}

mkdirSync('/opt/cursor/artifacts', { recursive: true });
const log = spawn('npx', ['playwright', 'test', 'e2e/flujos-en-pagina.spec.ts', '--reporter=list'], {
  cwd: RAIZ,
  env: { ...envNext, HUB_BASE_URL: ORIGEN_NEXT, CI: '1' },
  stdio: 'inherit',
});
const codigo = await new Promise((resolve) => log.on('exit', resolve));
writeFileSync('/opt/cursor/artifacts/e2e-playwright-exit.txt', String(codigo));
execFileSync('bash', ['-lc', 'f=$(find test-results -name video.webm | head -1); if [ -n "$f" ]; then cp "$f" /opt/cursor/artifacts/flujos-e2e.webm; fi'], { cwd: RAIZ });
matar(next);
rest.kill('SIGTERM');
puente.close();
process.exit(codigo ?? 1);
