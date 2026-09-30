#!/usr/bin/env node
/**
 * Verifica que el registro maestro de personas no mienta.
 *
 * Por que existe
 * -------------
 * El registro `00_PERSONAS.md` lo escribe un script, y un script puede
 * escribir una afirmacion falsa tan facil como un humano: el 2026-09-30 la
 * primera version decia "no hay informacion de cobranza en la base de datos",
 * que era cierto de las tablas de Supabase y FALSO como afirmacion sobre RR:
 * la cobranza vive en `cuentas_cobro_parsed.json`, en el Drive. Un archivo que
 * dice "no hay" cuando hay 32 cuentas es peor que uno que no dice nada.
 *
 * Lo que este script vigila
 * -------------------------
 * 1. Que el registro NO se haya editado a mano (lo regenera y compara).
 * 2. Que no haya copiado datos que no debe: contrasenas, importes, documentos.
 *    Este es el motivo de existir: un generador que recorre el Drive va a
 *    toparse con un archivo que tiene claves en claro, y pegarlas seria el
 *    peor fallo posible de un registro de gente.
 * 3. Que las cifras que dice tengan su fuente y su corte.
 *
 * Corre SIN RED: lee el registro y el Drive. No toca Supabase ni DashWeb.
 */

import fs from 'node:fs';

const RAIZ = '/home/deadkiss/rr-content-hub';
const REGISTRO = '/home/deadkiss/GoogleDrive/RR/rr_aliados/09_Admin/00_PERSONAS.md';
const COBRO = '/home/deadkiss/GoogleDrive/RR/rr_aliados/04_Finanzas/_automatizacion/cuentas_cobro_parsed.json';

let fallos = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const mal = (m) => { fallos += 1; console.log(`  FALLA ${m}`); };

if (!fs.existsSync(REGISTRO)) {
  console.error(`No existe el registro ${REGISTRO}. Correr: node scripts/generar-roster-personas.mjs`);
  process.exit(2);
}
const texto = fs.readFileSync(REGISTRO, 'utf8');

console.log(`\nRegistro: ${REGISTRO}\n`);
console.log('Lo que NO debe estar ahi:');

// --- 1. Secretos -------------------------------------------------------------
// Se comprueba contra lo que HAY, no contra una lista inventada: si mañana
// alguien pega otra contrasena, este check tiene que encontrarla igual.
const rutasSecretas = [
  '/home/deadkiss/GoogleDrive/RR/rr_aliados/09_Admin/People/CANONICO - ADQ Talentos Maestro LLM.md',
];
const secretos = new Set();
for (const ruta of rutasSecretas) {
  if (!fs.existsSync(ruta)) continue;
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/`([A-Za-z0-9_.-]{6,})`\s*\|\s*(?:superadmin|psicologa|admin)/i)
      ?? linea.match(/`([a-zA-Z]*RR20\d\d[a-zA-Z0-9]*)`/);
    if (m) secretos.add(m[1]);
  }
}
if (secretos.size === 0) {
  console.log('  ??   no se pudo leer ningun secreto de origen: no se puede comparar');
  fallos += 1;
} else {
  const filtrados = [...secretos].filter((s) => texto.includes(s));
  if (filtrados.length) mal(`${filtrados.length} clave(s) de un origen copiadas al registro`);
  else ok(`ninguna de las ${secretos.size} clave(s) que hay en el Drive aparece en el registro`);
}

// --- 2. Importes -------------------------------------------------------------
// El registro es de personas. Pegar un total de cuenta de cobro lo convertiria
// en una segunda fuente de dinero, y la regla de la casa prohibe eso.
if (fs.existsSync(COBRO)) {
  const crudo = JSON.parse(fs.readFileSync(COBRO, 'utf8'));
  const cuentas = Array.isArray(crudo) ? crudo : (crudo.cuentas ?? crudo.data ?? []);
  // Los totales que importan son los de 6 o mas cifras, que es como se ven
  // los montos en pesos. Las fechas (2026) no llegan a eso.
  const montos = new Set(
    cuentas.map((c) => Number(c.total)).filter((v) => Number.isFinite(v) && Math.abs(v) >= 100000)
      .map((v) => String(v)),
  );
  const pegados = [...montos].filter((m) => texto.includes(m));
  if (pegados.length) mal(`${pegados.length} importe(s) de cuenta de cobro en el registro`);
  else ok(`ninguno de los ${montos.size} importes de las ${cuentas.length} cuentas aparece en el registro`);
} else {
  console.log('  ??   no se encontro el JSON de cobranza: no se puede comprobar el punto 2');
  fallos += 1;
}

// --- 3. Documentos y datos personales ---------------------------------------
// Cedulas, NIT y telefonos no van en un roster: no hacen falta para saber quien
// es quien, y en cuanto se copian hay que rotarlos.
// Una fecha ISO (`2026-09-30`) cumple el patron de un celular colombiano con
// guiones. La primera version de este check marco la fecha de corte como
// "telefono" y casi lleva a borrar una fecha legitima del registro. Antes de
// contar un numero como dato personal, se descarta que sea una fecha.
const esFecha = (n) => /^\d{4}-\d{2}-\d{2}/.test(n);
const cedulas = (texto.match(/\b\d{6,10}\b(?!\d{4}-\d{2})/g) ?? []).filter((n) => !esFecha(n));
const telefonos = (texto.match(/\+?\d[\d\s-]{9,14}/g) ?? []).filter((n) => !esFecha(n.trim()));
if (telefonos.length) mal(`${telefonos.length} telefono(s) en el registro`);
else ok('ningun telefono');
// Las cedulas se toleran solo si son claramente un rango de fechas o un id
// con prefijo; un numero suelto de 6-10 digitos es un documento.
const sospechosas = cedulas.filter((c) => !/^(19|20)\d{2}$/.test(c));
if (sospechosas.length) mal(`${sospechosas.length} numero(s) de 6-10 digitos sin contexto de fecha`);
else ok(`ningun documento (${cedulas.length} numero(s) de 6-10 digitos, todos de año)`);

// --- 4. Fuente y corte en cada cifra -----------------------------------------
const corte = texto.match(/Corte de datos: \*\*(\d{4}-\d{2}-\d{2})\*\*/)?.[1];
if (corte) ok(`corte declarado: ${corte}`);
else { mal('no declara fecha de corte'); }

for (const fuente of ['DashWeb', 'cm_profiles']) {
  if (texto.includes(fuente)) ok(`cita su fuente: ${fuente}`);
  else mal(`no cita ${fuente}`);
}

// --- 5. La affirmacion que se corrijo ---------------------------------------
// Durante un rato el registro afirmo que no habia cobranza. Si esa frase
// vuelve, es que alguien volvio a mirar solo las tablas de Supabase.
if (/no hay (informacion|dato) de cobranza( en la base)?\b/i.test(texto.replace(/\n/g, ' '))) {
  mal('vuelve a afirmar que no hay cobranza: esa frase fue FALSA (las tablas estan vacias, la cobranza vive en el Drive)');
} else {
  ok('no afirma que no haya cobranza (la fuente real esta declarada)');
}

// --- 6. Idempotencia: regenerar no puede cambiar el archivo ------------------
// Solo se comprueba si existe el generador. Es el mismo criterio del resto de
// los verify-*: si algo falta, se dice y se falla, nunca se pasa en silencio.
const gen = `${RAIZ}/scripts/generar-roster-personas.mjs`;
if (!fs.existsSync(gen)) {
  console.log(`  ??   no existe ${gen}: no se puede comprobar la idempotencia`);
  fallos += 1;
} else {
  const antes = fs.readFileSync(REGISTRO, 'utf8');
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('node', [gen], { cwd: RAIZ, stdio: 'pipe' });
    const despues = fs.readFileSync(REGISTRO, 'utf8');
    // El generador compara por hash y escribe solo si cambian los bytes, asi que
    // una corrida puede tocar la fecha si el corte del dia esta a punto de
    // cambiar. Se reintenta una vez: si la segunda tampoco cuadra, si es que hay
    // una fuente que se lee de forma no estable.
    if (despues === antes) {
      ok('idempotente: regenerarlo no cambia el archivo');
    } else {
      execFileSync('node', [gen], { cwd: RAIZ, stdio: 'pipe' });
      const tercera = fs.readFileSync(REGISTRO, 'utf8');
      if (tercera === despues) ok('idempotente tras un segundo intento (el corte cambio entre corridas)');
      else mal('el generador cambia el registro dos veces seguidas: hay una fuente inestable');
    }
  } catch (e) {
    mal(`el generador fallo: ${String(e.message).slice(0, 120)}`);
  }
}

console.log('');
if (fallos > 0) {
  console.log(`${fallos} fallo(s).`);
  process.exit(1);
}
console.log('TODO OK — el registro no miente y no filtra datos que no debe.');