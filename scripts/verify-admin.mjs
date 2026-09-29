// La guarda de admin es el unico control entre internet y el roster completo
// (correos, roles globales, invitaciones). Un test que verifique que existe no
// sirve de nada si no verifica que la USAN: por eso lee las rutas, no el
// modulo de la guarda.
//   npm run verify:admin
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

let fails = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`PASS  ${name}`); return; }
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  fails += 1;
};

// 1. La guarda existe y es solo-servidor. Un guard que acabe en el bundle
//    cliente es peor que no tener ninguno: da falsa sensacion de seguridad.
const guard = read('src/lib/admin-guard.ts');
check('admin-guard.ts existe', fs.existsSync(path.join(repoRoot, 'src/lib/admin-guard.ts')));
check('la guarda es solo-servidor (import de server-only)', /^import 'server-only';/m.test(guard));
check('requireAdmin devuelve un veredicto, no un booleano', /allowed: (true|false)/.test(guard));
check('no distingue entre no-sesion y no-admin en la respuesta', !/reason: 'not-admin'[\s\S]{0,80}status/.test(guard));

// 2. Admin exige global_role = admin. Un rol de proyecto NO da acceso admin:
//    un client_approver no debe poder leer el roster de toda la empresa.
check('admin exige global_role admin', /global_role[^\n]*admin|global_role !== 'admin'/.test(guard));
check('no acepta roles de proyecto como admin', !/role_in_project/.test(guard));

// 3. Hay un camino de vuelta. Las tres tablas de acceso estan vacias en
//    produccion, asi que un control estricto sin escape dejaria a todos fuera
//    y la unica salida seria por SQL.
check('existe escape hatch por variable de entorno', /SUPER_ADMIN_EMAILS/.test(guard));
check('el escape hatch solo se aplica con sesion iniciada', /currentEmail\(\)[\s\S]{0,200}SUPER_ADMIN_EMAILS/.test(guard));

// 4. LA RUTA USA LA GUARDA. Esta es la comprobacion que importa: existia
//    /audit/admin sin ninguna comprobacion y renderizaba el roster entero a
//    cualquiera que escribiera la URL.
const adminPage = read('src/app/audit/admin/page.tsx');
check('/audit/admin llama a requireAdmin', /requireAdmin\(\)/.test(adminPage));
check('/audit/admin corta con notFound cuando no es admin', /!admin\.allowed[\s\S]{0,40}notFound\(\)/.test(adminPage));
check('la guarda corre ANTES de leer datos', adminPage.indexOf('requireAdmin()') < adminPage.indexOf('getAuditRoster()'));

// 5. La respuesta para un anonimo no confirma que la ruta existe. Un 403 dice
//    "esto existe y no puedes"; un 404 no dice nada.
check('un rechazo no renderiza nada de la pagina', !/if \(!admin\.allowed\)[\s\S]{0,120}return <div/.test(adminPage));

// 6. La pagina /admin antigua solo redirige; no debe quedar como puerta trasera.
//    Se examina el codigo sin comentarios: el docblock menciona "roster" al
//    describir a donde se movio, y un test que se deje llevar por un comentario
//    se pone en rojo sin motivo.
const legacyCode = read('src/app/admin/page.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check('/admin no llama a ninguna funcion de datos', !/getAudit|getProjects|getRoster|roster\./.test(legacyCode));
check('/admin solo redirige', /redirect\(/.test(legacyCode) && !/return <[a-z]/.test(legacyCode));
// Y que no mande a un cliente fijo. Con la puerta por codigo, `/admin` tiene que
// ir al cliente de la cookie: entering con 2222 y caer en Wundeer seria un
// enlace que funciona y lleva al sitio equivocado.
check('/admin no manda a un cliente fijo', !/redirect\('\/(wundeer|candilejas|boga|satiro)/.test(legacyCode));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
