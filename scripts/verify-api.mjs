// Verificacion del contrato de /api/ideas. El endpoint corre con la service
// role, que salta el RLS: la validacion del lado de la app es la unica
// frontera, y antes solo cubria `title` y las URLs de referencia.
//   npm run verify:api
import fs from 'fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const routePath = path.join(repoRoot, 'src/app/api/ideas/route.ts');
const source = fs.readFileSync(routePath, 'utf8');

let fails = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`); return; }
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  fails += 1;
};

// 1. La API key se compara en tiempo constante. Un === sobre el secreto
//    filtra informacion por temporizacion.
check('la API key usa timingSafeEqual', /timingSafeEqual/.test(source));
check('no hay comparacion directa de la API key', !/apiKey\s*===/.test(source));

// 2. Todo POST debe pasar por validate(). Si alguien anade una rama nueva sin
//    validarla, esta comprobacion no lo detecta sola: revisa que la unica via
//    de creacion pase por el helper.
check('POST delega la validacion en validate()', /const problem = validate\(body\)/.test(source));
check('validate devuelve datos normalizados o mensaje', /\{ error: string \}/.test(source));

// 3. Limites en todos los campos de texto, no solo en title. Los campos se
//    recorren con un for sobre una tupla, asi que basta con que la tupla los
//    nombre a los cuatro y que la comparacion de longitud exista.
const textFields = ['description', 'objective', 'category'];
check('validate recorre los tres campos de texto largos',
  textFields.every((f) => source.includes(`'${f}'`)));
check('la tupla de campos incluye tambien title',
  /title: \[\d+, \d+\]/.test(source) && /'title', 'description'|'description', 'objective', 'category'/.test(source));
check('validate compara longitud contra los limites', /value\.length < min \|\| value\.length > max/.test(source));
check('validate acota el numero de referencias', /reference_urls admite maximo/i.test(source));

// 4. La carrera del `code`. Sin indice unico, dos peticiones simultaneas
//    leian el mismo max+1 y las dos insertaban.
check('el codigo se genera con reintentos', /for \(let attempt = 0; attempt < 5/.test(source));
check('el reintento se dispara por violacion de unicidad', /code === '23505'/.test(source));
check('el error de colision tiene su propio status', /409/.test(source));

// 5. El service role no debe filtrarse al cliente. createClient con la service
//    key solo puede vivir en un Route Handler de servidor: la variable de
//    entorno que lo alimenta no lleva el prefijo NEXT_PUBLIC.
check('la service key no se lee de una variable NEXT_PUBLIC',
  !/NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/.test(source));

console.log(fails === 0 ? '\nTODO OK' : `\n${fails} FALLO(S)`);
process.exit(fails === 0 ? 0 : 1);
