// Ninguna tabla del flujo puede escribirse desde el navegador.
//
// La regla: todo INSERT/UPDATE/UPSERT/DELETE de rr_hub_* ocurre en un Route
// Handler, nunca en un componente ni en un modulo 'use client'. Antes de esto,
// las seis mutaciones del workspace escribian con la anon key desde el cliente,
// y el comentario de transitionIdeaStatus afirmaba que un request a mano no
// podia saltarse estados. Si:
//
//   - el codigo que decide esta regla mira los .ts de components/ y lib/; y
//   - un test verifica que la regla sigue cumpliendose;
//
// entonces volver a meter un .insert() en el cliente rompe la build de tests,
// no la seguridad en produccion, que es donde mas duele.
//   npm run verify:writes
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let fails = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`PASS  ${name}`); return; }
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  fails += 1;
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const strip = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const WRITE = /\.from\(\s*['"`]rr_hub_\w+['"`]\s*\)[\s\S]{0,40}?\.(insert|update|upsert|delete)\s*\(/g;

// 1. Ningun archivo de components/ o lib/ escribe en rr_hub_*.
const offenders = [];
for (const dir of ['src/components', 'src/lib']) {
  for (const file of walk(path.join(repoRoot, dir))) {
    const rel = path.relative(repoRoot, file);
    const hits = strip(fs.readFileSync(file, 'utf8')).match(WRITE);
    if (hits) offenders.push(`${rel}: ${hits.length} escritura(s)`);
  }
}
check('ningun modulo cliente escribe en rr_hub_*', offenders.length === 0, offenders.join(' | '));

// 2. La subida a Storage sigue yendo desde el navegador, pero SOLO el upload:
//    los bytes necesitan la sesion para que las politicas de storage.objects
//    decidan. Lo que no puede seguir asi es el INSERT de la fila de metadata.
//
//    Desde el 2026-09-28 la puerta es un codigo por cliente y la identidad viaja
//    en una cookie firmada del hub, no en un token de Supabase. La cookie la
//    manda el navegador solo, asi que el cliente ya no pone ninguna cabecera de
//    autorizacion: lo que se comprueba es que no mande un token viejo.
const storage = fs.readFileSync(path.join(repoRoot, 'src/lib/workspace-client.ts'), 'utf8');
// Los bytes ya NO suben desde el navegador. Se subian con la clave anon y las
// politicas de storage.objects eran del rol `authenticated`, que ya no existe:
// medido el 2026-09-28, `403` para todo el equipo. Ahora van por `/api/subir`.
check('el navegador NO sube bytes a Storage', !/supabase\.storage[\s\S]{0,60}?\.upload\(/.test(storage));
check('los bytes van al servidor', /fetch\('\/api\/subir'/.test(storage));
// La cookie viaja sola: el cliente no debe mandar token, y debe decirlo claro
// con `credentials`, que es lo que hace que el navegador la incluya.
check('el upload se apoya en la cookie, no en un token', !/auth\.getSession\(\)/.test(storage));
check('las llamadas mandan la cookie explicitamente', /credentials: 'same-origin'/.test(storage));
// El id de quien sube ya no lo pone el cliente: lo saca el servidor de la
// cookie, y arma la ruta con ese id. Antes la ruta la escribia el navegador.
check('el cliente no elige la ruta del archivo', !/const path = `\$\{/.test(storage));

// La ruta de subida tiene que cumplir lo que la de workspace cumplia, y una
// cosa mas: mirar los bytes, no lo que el navegador declare.
const subir = fs.readFileSync(path.join(repoRoot, 'src/app/api/subir/route.ts'), 'utf8');
check('la subida exige la cookie de la puerta', /quienEs\(\)/.test(subir));
check('la subida ata el archivo a quien entro por la puerta', /ilike\('email', sesion\.email\)/.test(subir));
check('la subida comprueba que el cliente sea el de la cookie', /projectSlug !== sesion\.proyecto/.test(subir));
check('la metadata del asset la escribe el servidor', /rr_hub_assets'\)\.insert/.test(subir));
check('la subida mira los bytes, no lo que el navegador declara', /firmaDeImagen\(/.test(subir));
// `version_label` es NOT NULL con default 'v1'. Mandar null explicitamente hace
// fallar el insert aunque la base tenga default: el archivo queda en el bucket
// sin fila, o sea invisible. Medido el 2026-09-28.
check('la subida no manda version_label en null', !/versionLabel = null/.test(subir) && /\|\| 'v1'/.test(subir));

// 3. El servidor existe y es quien autoriza.
const route = fs.readFileSync(path.join(repoRoot, 'src/app/api/workspace/[action]/route.ts'), 'utf8');
check('la ruta de workspace existe', route.length > 0);
check('el servidor usa la service role para escribir', /SUPABASE_SERVICE_ROLE_KEY/.test(route));
// La puerta: el servidor tiene que saber quien entra por la cookie firmada, y
// no aceptar ninguna identidad que venga en el cuerpo de la peticion.
check('el servidor exige la cookie de la puerta', /quienEs\(\)/.test(route));

// El modo abierto se fue con la puerta por codigo (2026-09-28). Si vuelve, la
// variable que lo apagaba es la que hay que vigilar: NEXT_PUBLIC_AUTH_ENABLED no
// estaba puesta en Vercel, asi que el hub se creia abierto siempre y el 401 le
// salia a quien entraba bien. Una puerta con un boton de "abrir" que nadie
// vigila no es una puerta.
// Se mira que no quede una ASIGNACION, no la palabra: el comentario explica que
// la variable se quito, y el comentario es lo que hay que conservar.
// La cookie manda sobre la URL, tambien en la auditoria. Con 1111 no se puede
// abrir /audit/candilejas a mano: ver sin escribir sigue siendo ver lo de otro
// cliente, y la auditoria no es una puerta trasera.
check('la auditoria tambien pide que el cliente sea el de la cookie',
      /getAuditProject[\s\S]{0,900}clienteEsVisible\(slug, sesion\.proyecto\)/.test(
        fs.readFileSync(path.join(repoRoot, 'src/lib/data.ts'), 'utf8')));

check('el modo abierto no vuelve', !/=\s*process\.env\.NEXT_PUBLIC_AUTH_ENABLED/.test(route));
check('nadie decide el acceso leyendo una variable de entorno', !/process\.env\.NEXT_PUBLIC_AUTH_ENABLED\s*[!=]/.test(route));
check('el 401 no habla de una sesion que ya no existe', !/Necesitas una sesi/.test(route));
check('el servidor NO acepta la identidad del cuerpo', !/body\.email\b/.test(route));
check('el rol se lee de rr_hub_access, no del cuerpo', /from\('rr_hub_access'\)[\s\S]{0,80}role_in_project/.test(route));
check('el servidor NO acepta el rol del cliente', !/body\.role\b/.test(route));
// Un comentario que promete una garantia falsa es peor que no prometer nada.
check('el servidor valida transiciones con el motor real', /allowedTransitions\(role, from\)/.test(route));
// El estado real se lee de la base, no del que dice el navegador.
check('el servidor relee el estado antes de transicionar', /current\.status !== from/.test(route));
check('una discrepancia de estado da 409', /409/.test(route));
// La atribucion de un comentario no la elige quien lo escribe.
check('el autor del comentario lo pone el servidor', /author_label: `\$\{(?:ctx\.)?email\}/.test(route));

// 4. Las mutaciones pasan por la API.
//
// 'asset' ya no está en la lista: desde el 2026-09-28 los bytes y su metadata
// los escribe el servidor en `/api/subir`, porque la subida directa a Storage
// con la clave del navegador daba 403 (las políticas eran del rol
// `authenticated`, que ya no existe). El cliente ya no llama a ninguna acción
// para un archivo: manda el archivo y el servidor decide.
for (const action of ['transition', 'script', 'comment', 'resolve-comment']) {
  check(`el cliente llama a la acción '${action}'`, storage.includes(`postWorkspaceAction('${action}'`));
}
check('el cliente llama a create-idea', /create-idea/.test(storage));

// 5. La asignacion del `code` ocurre en un solo sitio por ruta, con reintento.
//    Dos max+1 simultaneos entregaban el mismo numero dos veces.
for (const [name, file] of [
  ['api/ideas', 'src/app/api/ideas/route.ts'],
  ['workspace/create-idea', 'src/app/api/workspace/[action]/route.ts'],
]) {
  const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  // Las dos rutas reintentan, pero con la forma que corresponde a cada una:
  // /api/ideas hace `continue` dentro de un for, createIdea devuelve 409 al
  // agotar los intentos. Lo que no puede pasar es que una mentione 23505 y la
  // otra no, porque eso significaria una sin proteccion.
  check(`${name} reintenta ante colisión de código`, /23505/.test(source));
  check(`${name} no acepta un code del cuerpo`, !/code:\s*(body|input)\./.test(source));
  // Cada ruta con su forma de reintento: /api/ideas continua el bucle,
  // createIdea sale con 409 al agotar. Basta con que una de las dos formas
  // exista en cada archivo.
  const retries = /(continue;|return error\([^)]*409\))/.test(source);
  check(`${name} tiene un camino de reintento real`, retries);

}

// 6. La ruta antigua de escritura de roles desaparece con el componente.
check('access-admin.tsx ya no existe', !fs.existsSync(path.join(repoRoot, 'src/components/access-admin.tsx')));
check('no queda ningun escritor de rr_hub_access', offenders.every((o) => !o.includes('access')));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
