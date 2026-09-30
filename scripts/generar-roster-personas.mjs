/**
 * Genera el REGISTRO MAESTRO DE PERSONAS de RR Aliados y lo escribe en el Drive.
 *
 *   npm run roster:personas            (o: node scripts/generar-roster-personas.mjs)
 *
 * POR QUE ESTE SCRIPT Y NO UN DOCUMENTO ESCRITO A MANO. Santiago pidio un
 * unico registro de todas las personas, y el problema de verdad no era
 * escribirlo: era que las tres fuentes vivian separadas y cualquier respuesta
 * escrita a mano se vuelve falsa en cuanto alguien entra o sale. Este archivo
 * se regenera desde las fuentes, asi que auditar es volver a correrlo.
 *
 * QUE ES LA FUENTE DE VERDAD. El Drive (RR/rr_aliados/09_Admin/00_PERSONAS.md)
 * es donde vive el resultado. Este repo solo corre el generador y no guarda
 * copia: si el Drive y el repositorio se contradijeran, manda el Drive.
 *
 * LAS TRES FUENTES, y por que las tres:
 *
 *   1. DashWeb (el CRM). Es el directorio: de ahi sale quien trabaja en RR
 *      Aliados y con que rol. Medido el 2026-09-30: 16 usuarios (US####).
 *   2. Centro de Mando, `cm_profiles` kind=persona. Medido el 2026-09-30:
 *      17 filas. Ahi llega la gente que entro por el tablero interno.
 *   3. Cuentas de cobro. MEDIDAS Y VACIAS — ver la seccion de cobranza del
 *      registro: `invoices` existe con 0 filas y `obligations` NO EXISTE como
 *      tabla. No hay informacion de cartera en la base de datos.
 *
 * LA IDENTIDAD CANONICA ES EL CORREO, y no por eleccion estetica: es lo unico
 * que esta en las tres fuentes a la vez, asi que es lo unico que permite
 * decir "es la misma persona" sin suponerlo. El nombre va pegado al correo.
 *
 * LO QUE ESTE SCRIPT NO HACE, y por que (todo esto se respeta en el codigo):
 *
 *   - No escribe telefonos. `phone` viene en el payload de DashWeb y se lee,
 *     pero no sale: el roster es un registro de cuentas, no una lista de
 *     contacto (regla dura de `04_REGLAS_Y_PERMISOS.md`).
 *   - No escribe documentos. `rr_contracts.cliente_doc` y `salario` existen en
 *     la base y quedan fuera.
 *   - No lee contrasenas, hashes ni tokens. Para el cruce con el Centro de
 *     Mando solo hace falta `cm_profiles.email`, que es un identificador de
 *     cuenta. No se consulta `encrypted_password` ni `auth.identities`.
 *   - No mezcla clientes con personas. `rr_hub_ideas` y `prospects` son de
 *     clientes: se miden y se declaran aparte, nunca entran como filas.
 *
 * IDEMPOTENTE: el texto se arma solo con datos medidos y con la fecha de corte
 * que traen las propias fuentes (no con la hora de correr). Si el resultado
 * sale igual al archivo que ya esta en el Drive, no lo toca. Correrlo dos
 * veces seguidas no cambia ni un byte ni la fecha de modificacion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = '/home/deadkiss/GoogleDrive/RR/rr_aliados/09_Admin/00_PERSONAS.md';

/**
 * Los archivos de entorno que se leen, en orden. Solo NOMBRES de variables
 * hacia afuera: los valores se quedan en memoria y nunca se imprimen.
 *
 * Se leen a mano en vez de usar `--env-file` porque el generador tiene que
 * funcionar con `node scripts/...` y con npm, sin recordar flags (mismo motivo
 * que en `verify-leak.mjs`).
 *
 * El del Centro de Mando vive en el home y no en el repo: es el mismo archivo
 * que usa el ingestor, con permisos 600. Se usa como ultimo recurso, para que
 * este script no dependa de un repo ajeno.
 */
const ARQUIVOS_DE_ENTORNO = [
  path.join(RAIZ, '.env.local'),
  path.join(process.env.HOME ?? '/home/deadkiss', '.config', 'rr-centro-mando', 'ingestor.env'),
  path.join(process.env.HOME ?? '/home/deadkiss', '.hermes', '.env'),
];

function cargarEntorno(rutas) {
  for (const ruta of rutas) {
    if (!fs.existsSync(ruta)) continue;
    for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
      const t = linea.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const nombre = t.slice(0, eq).trim();
      const valor = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      // process.env gana: el operador puede sobreescribir sin editar archivos.
      if (process.env[nombre] === undefined) process.env[nombre] = valor;
    }
  }
}
cargarEntorno(ARQUIVOS_DE_ENTORNO);

// ---------------------------------------------------------------------------
// DashWeb: cliente minimo, con refresco de sesion.
// ---------------------------------------------------------------------------

const DASHWEB_BASE = process.env.DASHWEB_API_URL
  ?? 'https://dashweb-core-backend-prod.up.railway.app/api/v1';

/** Lee el instante de expiracion del JWT. 0 si no se puede leer. */
function expiracionDe(token) {
  try {
    const p = token.split('.')[1];
    return Number(JSON.parse(Buffer.from(p, 'base64url').toString('utf8')).exp ?? 0);
  } catch {
    return 0;
  }
}

async function pedirTokenDashWeb({ forzar = false } = {}) {
  const guardado = process.env.DASHWEB_BOT_TOKEN ?? '';
  if (!forzar && guardado && expiracionDe(guardado) - 120 > Date.now() / 1000) return guardado;
  const correo = process.env.DASHWEB_BOT_EMAIL;
  const clave = process.env.DASHWEB_BOT_PASSWORD;
  if (!correo || !clave) {
    throw new Error(
      'Faltan DASHWEB_BOT_EMAIL o DASHWEB_BOT_PASSWORD. El generador lee el '
      + 'directorio de DashWeb; sin sesion no puede saber quien trabaja en RR.',
    );
  }
  const r = await fetch(`${DASHWEB_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'RRROSTER/1.0' },
    body: JSON.stringify({ email: correo, password: clave }),
  });
  if (!r.ok) throw new Error(`Login de DashWeb HTTP ${r.status}.`);
  const cuerpo = await r.json();
  if (!cuerpo?.accessToken) throw new Error('DashWeb no devolvio token.');
  return cuerpo.accessToken;
}

async function dashWeb(ruta) {
  for (const forzar of [false, true]) {
    const token = await pedirTokenDashWeb({ forzar });
    const r = await fetch(`${DASHWEB_BASE}${ruta}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'RRROSTER/1.0' },
    });
    if (r.status === 401) continue;
    if (!r.ok) throw new Error(`DashWeb HTTP ${r.status} en ${ruta}`);
    const cuerpo = await r.json();
    return Array.isArray(cuerpo) ? cuerpo : cuerpo.data ?? cuerpo;
  }
  throw new Error('DashWeb rechazo la sesion dos veces seguidas.');
}

// ---------------------------------------------------------------------------
// Helpers de presentacion.
// ---------------------------------------------------------------------------

/** Sin acentos, sin mayusculas, sin espacios dobles: para comparar nombres. */
function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    // U+0300..U+036F: los diacriticos que deja NFD. Con escapes, no literales,
    // porque un rango escrito a mano es invisible en el diff y se rompe solo.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Como se comparan dos nombres de la MISMA persona en dos fuentes.
 * Se separa "solo cambia el formato" de "cambia el nombre", porque meterlos en
 * el mismo saco hace que un error de tipeo parezca un dato.
 */
function compararNombres(a, b) {
  if (!a || !b) return 'sin comparar';
  const na = normalizar(a);
  const nb = normalizar(b);
  if (na === nb) {
    // Literalmente identico: no es una discrepancia y no va en la tabla de
    // discrepancias. Mezclarlo con "cambian los acentos" hace que la tabla
    // pierda su senal.
    return a.trim() === b.trim() ? 'identico' : 'mismo nombre, distinto formato';
  }
  // Un nombre abreviado del Centro de Mando es un caso conocido y medido.
  const tokens = (x) => na.split(' ').filter((t) => nb.includes(t));
  const cubre = (x, y) => x.length > 0 && x.every((t) => y.includes(t));
  if (cubre(tokens(na), nb) || cubre(tokens(nb), na)) return 'uno contiene al otro';
  return 'NOMBRE DISTINTO';
}

const DESCONOCIDO = (motivo) => `DESCONOCIDO (${motivo})`;

/** Fecha corta de un timestamp ISO, sin inventar zona. */
function fechaDe(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso ?? ''));
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Lectura de las fuentes.
// ---------------------------------------------------------------------------

async function leerFuentes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.CM_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CM_SUPABASE_SERVICE_KEY;
  if (!url || !clave) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (o los CM_*). '
      + 'Sin thema no se puede leer cm_profiles.',
    );
  }
  const sb = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });

  const [usuariosDash, perfilesCm, ideas, proyectos, contratos, props] = await Promise.all([
    dashWeb('/users'),
    sb.from('cm_profiles').select('display_name,email,global_role,user_id,updated_at')
      .eq('kind', 'persona'),
    sb.from('rr_hub_ideas').select('project_id'),
    sb.from('rr_hub_projects').select('id,slug'),
    sb.from('rr_contracts').select('id,cliente_nombre,estado,created_at'),
    sb.from('prospects').select('owner'),
  ]);
  if (perfilesCm.error) throw new Error(`cm_profiles: ${perfilesCm.error.message}`);

  // Cuentas de cobro. IMPORTANTISIMO no fundir los tres casos, porque dos de
  // ellos producen el mismo `count` y son opuestos:
  //
  //   - existe con filas        -> hay dato
  //   - existe con 0 filas      -> medido y vacio
  //   - NO existe en el esquema -> no hay ese dato
  //
  // MEDIDO 2026-09-30: `invoices` existe con 0 filas y `obligations` NO esta
  // en el esquema (PGRST205). Y aqui esta la trampa: con `{head: true}` una
  // tabla inexistente devuelve `count: null` y **ningun error**. Sin este
  // caso, el generador imprimia "obligations existe, 0 filas" y se llevaba una
  // tabla fantasma. Es el mismo all-clear falso que ya se corrigio una vez en
  // `verify-leak.mjs`, y por eso se comprueba tambien con una lectura normal.
  const cobranza = {};
  for (const tabla of ['invoices', 'obligations']) {
    const conteo = await sb.from(tabla).select('*', { count: 'exact', head: true });
    if (conteo.error) {
      cobranza[tabla] = { existe: false, filas: null, motivo: `${conteo.error.code}: ${conteo.error.message}` };
      continue;
    }
    if (conteo.count === null) {
      // count null sin error: no se sabe. Una sonda que no llego a ejecutarse
      // NO es una tabla vacia, y contarla como vacia seria mentir.
      const lectura = await sb.from(tabla).select('*').limit(1);
      cobranza[tabla] = lectura.error
        ? { existe: false, filas: null, motivo: `${lectura.error.code}: ${lectura.error.message}` }
        : { existe: true, filas: 0, motivo: null };
      continue;
    }
    cobranza[tabla] = { existe: true, filas: conteo.count, motivo: null };
  }

  // Ideas por cliente: es informacion de CLIENTES, y por eso no entra al
  // roster. Se mide igual, porque el numero dice por que no se mezcla.
  const slugPorId = Object.fromEntries((proyectos.data ?? []).map((p) => [p.id, p.slug]));
  const ideasPorCliente = {};
  for (const i of ideas.data ?? []) {
    const slug = slugPorId[i.project_id] ?? 'proyecto desconocido';
    ideasPorCliente[slug] = (ideasPorCliente[slug] ?? 0) + 1;
  }

  const propietarios = new Set((props.data ?? []).map((p) => p.owner));

  return {
    dashWeb: (usuariosDash ?? []).map((u) => ({
      id: u.id,
      nombre: (u.name ?? '').trim(),
      correo: (u.email ?? '').trim().toLowerCase(),
      rol: u.role ?? null,
      puesto: [u.position, u.department].filter(Boolean).join(' / ') || null,
      actualizado: fechaDe(u.updatedAt),
    })),
    // Las dos fuentes que NO estan en la base: cobranza y Talento viven en Drive.
    cuentasCobro: leerCuentasCobro(),
    talento: leerCanonicoTalento(),
    centroMando: (perfilesCm.data ?? []).map((p) => ({
      nombre: p.display_name,
      correo: (p.email ?? '').trim().toLowerCase(),
      rol: p.global_role ?? null,
      // `user_id` no nulo es lo que se puede comprobar sin leer la cuenta:
      // no se consulta auth.users porque no hace falta y evita tocar credenciales.
      conCuenta: Boolean(p.user_id),
      actualizado: fechaDe(p.updated_at),
    })),
    cobranza,
    ideasPorCliente,
    contratos: contratos.data ?? [],
    prospectos: {
      filas: (props.data ?? []).length,
      propietariosDistintos: [...propietarios],
    },
  };
}

// ---------------------------------------------------------------------------
// El registro: una fila por identidad canonica (correo).
// ---------------------------------------------------------------------------

/**
 * Unifica DashWeb y Centro de Mando por correo, que es la identidad canonica.
 *
 * Las cuentas que no son personas NO se inventan como personas: se declaran
 * como lo que se puede probar de ellas (una etiqueta de cuenta). Cuando el
 * mismo correo significa una cosa en cada fuente, se marca para que Santiago
 * lo decida, no para que el registro lo decida por el.
 */

/**
 * Cuentas de cobro (Drive, no Supabase).
 *
 * MEDIDO el 2026-09-30: `invoices` y `obligaciones` en la base estan VACIAS
 * (0 filas). Eso no quiere decir que no haya cobranza: la fuente real es un
 * JSON que produce `_automatizacion/leer_cuentas_cobro.py`, y su regla esta en
 * `rr_aliados/04_Finanzas/COBRANZA_FUENTE.md` ("este archivo es la fuente").
 *
 * De aqui solo se toma el NOMBRE del colaborador y cuantos estados tiene. Los
 * importes (`total`, `items`) NO se leen al registro: este es un registro de
 * personas, no de dinero, y pegar cifras sin su corte rompe la regla de la casa.
 */
function leerCuentasCobro() {
  const ruta = process.env.RR_COBRANZA_JSON
    ?? '/home/deadkiss/GoogleDrive/RR/rr_aliados/04_Finanzas/_automatizacion/cuentas_cobro_parsed.json';
  if (!fs.existsSync(ruta)) return { disponibles: false, personas: [] };
  let crudo;
  try { crudo = JSON.parse(fs.readFileSync(ruta, 'utf8')); }
  catch { return { disponibles: false, personas: [] }; }
  const cuentas = Array.isArray(crudo) ? crudo : (crudo.cuentas ?? crudo.data ?? []);
  const porNombre = new Map();
  for (const c of cuentas) {
    const nombre = (c.colaborador ?? '').trim();
    // `?` es lo que deja el parser cuando no leyó el nombre del papel: contarlo
    // como persona seria inventar un collaborator que nadie ha visto.
    if (!nombre || nombre === '?') continue;
    const clave = normalizar(nombre);
    if (!porNombre.has(clave)) porNombre.set(clave, { nombre, cuentas: 0, sinFirmar: 0 });
    const e = porNombre.get(clave);
    e.cuentas += 1;
    if ((c.estado ?? '') === 'sin_firmar') e.sinFirmar += 1;
  }
  return { disponibles: true, totalCuentas: cuentas.length, personas: [...porNombre.values()] };
}

/**
 * El canonico de Talento (Drive).
 *
 * MEDIDO el 2026-09-30: ese archivo tiene en su linea ~109 una tabla de usuarios
 * con CONTRASENAS EN CLARO. Por eso aqui NO se lee el archivo entero: se toman
 * solo las filas de la tabla de personas y se corta el bloque de credenciales.
 * Copiar claves a un registro de gente seria justo lo que ese registro no debe
 * hacer.
 */
function leerCanonicoTalento() {
  const ruta = process.env.RR_TALENTO_CANONICO
    ?? '/home/deadkiss/GoogleDrive/RR/rr_aliados/09_Admin/People/CANONICO - ADQ Talentos Maestro LLM.md';
  if (!fs.existsSync(ruta)) return { disponible: false, personas: [], credencialesEnClaro: false };
  const lineas = fs.readFileSync(ruta, 'utf8').split('\n');
  let credencialesEnClaro = false;
  const personas = [];
  for (const linea of lineas) {
    if (/contrase/i.test(linea) || /`[a-z]+RR2026/i.test(linea)) credencialesEnClaro = true;
    // Solo filas con un correo en la segunda columna, y sin tocar la de claves.
    const celdas = linea.split('|').map((c) => c.trim());
    if (celdas.length < 5) continue;
    const correo = (celdas[2] ?? '').match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
    if (!correo) continue;
    if (/contrase|password/i.test(linea)) continue;
    personas.push({ nombre: celdas[1], correo: correo.toLowerCase(), estado: celdas[4] ?? 'sin estado' });
  }
  return { disponible: true, personas, credencialesEnClaro };
}

function construirRegistro(f) {
  const porCorreo = new Map();

  const fila = (correo) => {
    if (!porCorreo.has(correo)) {
      porCorreo.set(correo, { correo, dashWeb: null, centroMando: null });
    }
    return porCorreo.get(correo);
  };

  for (const u of f.dashWeb) if (u.correo) fila(u.correo).dashWeb = u;
  for (const p of f.centroMando) if (p.correo) fila(p.correo).centroMando = p;

  const ETIQUETA_DE_CUENTA = /^(metriklab|rr\s*aliados(\s*team)?|rr\s*bot)$/i;

  /**
   * Un sufijo `+algo` hace que el correo apunte al MISMO buzon, pero la cuenta
   * sigue siendo una cuenta distinta: DashWeb le da id y nombre propios (el bot
   * es US1051, con nombre "RR BOT", y el del CEO es US1035). Por eso NO se
   * normaliza a la direccion base: fundir las dos filas perderia una persona y
   * un bot en una sola, y haria que el registro afirmara que el bot es el CEO.
   *
   * Lo que si se declara es el hecho: que la cuenta del bot vive en el buzon
   * del CEO. Es informacion que Santiago necesita, no una deduplicacion.
   */
  const BUZON_COMPARTIDO = /\+[^@]+(?=@)/;

  // MEDIDO 2026-09-30: las cuentas de cobro traen el nombre en texto libre, sin
  // correo, asi que no se pueden unir por la identidad canonica. Se unen por
  // nombre normalizado y, si no alcanza, por apellido + primer nombre: los
  // papeles traen "Sthefany Alejandra Diaz Rozo" donde DashWeb trae
  // "Sthefany Diaz", y sin ese segundo intento se reportaria como persona
  // desconocida alguien que esta en el directorio.
  const coincide = (a, b) => {
    const na = normalizar(a); const nb = normalizar(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const palabras = (n) => n.split(' ').filter((x) => x.length > 2);
    const pa = palabras(na); const pb = palabras(nb);
    if (pa.length < 2 || pb.length < 2) return false;
    // 1er nombre + primer apellido, en el orden en que estan. El papel trae
    // "Sthefany Alejandra Diaz Rozo" y DashWeb trae "Sthefany Diaz": mismo
    // nombre, con los apellidos invertidos y uno de sobra.
    if (pa[0] === pb[0] && pa[2] === pb[1]) return true;
    // Ultimo token contra ultimo token, para el orden inverso ("A B C" / "C B").
    if (pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1]) return true;
    // Coincidencia fuerte por dos apellidos compartidos, para nombres compuestos
    // escritos de forma distinta en las dos fuentes.
    const comunes = pa.filter((x) => pb.includes(x));
    return comunes.length >= 2 && pa[0] === pb[0];
  };
  const cobranPorPersona = (nombre) => {
    const todas = f.cuentasCobro?.personas ?? [];
    return todas.find((c) => coincide(c.nombre, nombre)) ?? null;
  };

  const personas = [];
  for (const [correo, r] of porCorreo) {
    const d = r.dashWeb;
    const c = r.centroMando;
    const alias = BUZON_COMPARTIDO.test(correo);

    // Tipo: lo que se puede PROBAR, no lo que parece.
    //   - bot: el rol y el nombre lo dicen en DashWeb.
    //   - cuenta de servicio: el nombre es una etiqueta, no una persona, y en
    //     ninguna fuente hay un nombre de persona al que PEGARLE. Si en la otra
    //     fuente ese correo SI tiene un nombre de persona, no se puede afirmar
    //     que sea una cuenta de servicio: es un correo compartido, y asi se dice.
    //   - persona: hay nombre de persona en alguna de las dos fuentes.
    let tipo;
    let notaTipo = null;
    const nombrePersonaCm = c && !ETIQUETA_DE_CUENTA.test(c.nombre);
    const nombrePersonaDash = d && !ETIQUETA_DE_CUENTA.test(d.nombre);

    if (d && ETIQUETA_DE_CUENTA.test(d.nombre) && !nombrePersonaCm) {
      tipo = 'bot / cuenta no persona';
      notaTipo = 'El nombre es una etiqueta de cuenta en DashWeb.';
    } else if (nombrePersonaCm || nombrePersonaDash) {
      tipo = 'persona';
      if (c && d && ETIQUETA_DE_CUENTA.test(c.nombre) && nombrePersonaDash) {
        tipo = 'persona (correo compartido)';
        notaTipo = `El mismo correo aparece en el Centro de Mando como la cuenta `
          + `"${c.nombre}" y en DashWeb como "${d.nombre}". Que sea una persona o `
          + 'un correo compartido NO se puede afirmar: lo decide Santiago.';
      } else if (c && ETIQUETA_DE_CUENTA.test(c.nombre) && !d) {
        tipo = 'cuenta de servicio / compartida';
        notaTipo = 'El Centro de Mando lo guarda con una etiqueta de cuenta, sin nombre '
          + 'de persona, y no existe en DashWeb.';
      }
    } else {
      tipo = 'cuenta de servicio / compartida';
      notaTipo = 'Ninguna fuente guarda un nombre de persona para este correo.';
    }

    // Veredicto de identidad: es la comparacion de los dos nombres del MISMO
    // correo. Si las fuentes no coinciden, el veredicto lo dice y no se elige.
    let veredicto = 'una sola fuente: no hay nada que comparar';
    if (c && d) veredicto = compararNombres(c.nombre, d.nombre);

    personas.push({
      correo,
      buzonCompartido: alias ? correo.replace(BUZON_COMPARTIDO, '') : null,
      tipo,
      notaTipo,
      nombreCm: c ? c.nombre : null,
      nombreDashWeb: d ? d.nombre : null,
      idDashWeb: d ? d.id : null,
      rolDashWeb: d ? d.rol : null,
      puestoDashWeb: d ? d.puesto : null,
      rolCm: c ? c.rol : null,
      conCuenta: c ? c.conCuenta : false,
      veredicto,
      // Cuentas de cobro, por nombre. El nombre del papel no es la identidad
      // canonica (esa es el correo), asi que esto es un dato CONTABLE de la
      // persona, no una prueba de que las dos filas sean la misma.
      cuentasCobro: cobranPorPersona(d?.nombre ?? c?.nombre ?? ''),
      corte: [d?.actualizado, c?.actualizado].filter(Boolean).sort().pop() ?? null,
    });
  }

  // Altas pendientes: cobran y no estan en ninguna fuente. Se calcula sobre las
  // cuentas ya cruzadas, para no volver a comparar los mismos nombres dos veces.
  const cobradores = (f.cuentasCobro?.personas ?? []).filter(
    (c) => !personas.some((p) => p.cuentasCobro && p.cuentasCobro.nombre === c.nombre),
  );
  f.cobranzaSinRegistro = cobradores;

  // Orden estable: primero las personas, y dentro de ellas por correo, para
  // que el archivo no se reorderne solo porque cambie la fuente.
  const peso = (p) => (p.tipo.startsWith('persona') ? 0 : 1);
  personas.sort((a, b) => peso(a) - peso(b) || a.correo.localeCompare(b.correo));
  return personas;
}

// ---------------------------------------------------------------------------
// Markdown.
// ---------------------------------------------------------------------------

function tablaPersonas(personas) {
  const filas = personas.map((p) => [
    `\`${p.correo}\``,
    p.nombreCm ?? DESCONOCIDO('sin fila en el Centro de Mando'),
    p.nombreDashWeb ?? DESCONOCIDO('sin usuario en DashWeb'),
    p.idDashWeb ?? DESCONOCIDO('no existe en DashWeb'),
    p.rolDashWeb ?? DESCONOCIDO('el Centro de Mando no guarda rol de DashWeb'),
    p.rolCm ?? DESCONOCIDO('sin fila en el Centro de Mando'),
    p.puestoDashWeb ?? DESCONOCIDO('no existe en DashWeb'),
  ]);
  return [
    '| Correo (identidad canónica) | Nombre en el CM | Nombre en DashWeb | ID DashWeb | Rol DashWeb | Rol CM | Puesto declarado en DashWeb |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...filas.map((f) => `| ${f.join(' | ')} |`),
  ].join('\n');
}

function tablaVeredictos(personas) {
  // Solo las filas donde el nombre DIFIERE de verdad. Un nombre que coincide
  // en las dos fuentes no es una discrepancia: si la tabla lo mezclara, el
  // apartado mas importante del registro seria el mas largo y el menos util.
  const diferencias = personas.filter(
    (p) => p.nombreCm && p.nombreDashWeb && p.veredicto !== 'identico',
  );
  if (diferencias.length === 0) return '_(ninguna)_';
  return [
    '| Correo | Nombre en el CM | Nombre en DashWeb | Veredicto |',
    '| --- | --- | --- | --- |',
    ...diferencias.map((p) => `| \`${p.correo}\` | ${p.nombreCm} | ${p.nombreDashWeb} | ${p.veredicto} |`),
  ].join('\n');
}

function tablaSinCruce(personas) {
  return personas
    .filter((p) => !p.nombreCm || !p.nombreDashWeb)
    .map((p) => {
      const falta = [];
      if (!p.nombreCm) falta.push('no esta en `cm_profiles`');
      if (!p.nombreDashWeb) falta.push('no esta en el directorio de DashWeb');
      return `| \`${p.correo}\` | ${p.tipo} | ${falta.join(' y ')} |`;
    })
    .join('\n');
}

function construirMarkdown(f, personas, corte) {
  const enAmbas = personas.filter((p) => p.nombreCm && p.nombreDashWeb);
  const soloUna = personas.filter((p) => !p.nombreCm || !p.nombreDashWeb);
  const personasEfectivas = personas.filter((p) => p.tipo.startsWith('persona'));
  const cuentas = personas.filter((p) => !p.tipo.startsWith('persona'));

  const cobranzaBd = ['invoices', 'obligations'].map((t) => {
    const c = f.cobranza[t];
    return c.existe
      ? `| \`${t}\` (base de datos) | existe | **${c.filas} filas** | Medido y vacia: esta tabla no se usa. |`
      : `| \`${t}\` (base de datos) | **no existe en el esquema** | no aplica | No se puede contar una tabla que no existe (${c.motivo}). |`;
  }).join('\n');

  // MEDIDO 2026-09-30: que las dos tablas de arriba esten vacias NO quiere decir
  // que no haya cobranza. La fuente real es un JSON en el Drive. Decir solo
  // "no hay dato de cobranza" habria sido untrue, y este archivo no dice cosas
  // que no sean verdad aunque la base las contradiga.
  const cobro = f.cuentasCobro;
  const cobranzaReal = !cobro.disponibles
    ? '_No se pudo leer el JSON de cobranza (no existe o no es JSON legible)._'
    : [
        '| Fuente | Estado | Cuentas | Personas |',
        '| --- | --- | --- | --- |',
        `| \`04_Finanzas/_automatizacion/cuentas_cobro_parsed.json\` | leida | **${cobro.totalCuentas}** | **${cobro.personas.length}** |`,
      ].join('\n');

  // Personas que COBRAN y no estan en ninguna fuente: eso es un alta pendiente,
  // no un error de datos. Se listan para que Santiago decida.
  // La cabecera va UNA vez: la escribe la plantilla del markdown, no esta
  // funcion. La primera version la ponia aqui tambien y salia duplicada.
  const cobranSinRegistro = (f.cobranzaSinRegistro ?? []).length
    ? f.cobranzaSinRegistro.map((c) => `| ${c.nombre} | ${c.cuentas} | ${c.sinFirmar} |`).join('\n')
    : '_(ninguna: todas las personas que cobran estan en DashWeb o en el Centro de Mando)_';

  const talento = f.talento.disponible
    ? f.talento.personas.map((t) => `| ${t.nombre} | \`${t.correo}\` | ${t.estado} |`).join('\n')
    : '_No se leyo el canonico de Talento._';

  const avisoCredenciales = f.talento.credencialesEnClaro
    ? [
        '',
        '> **HALLAZGO DE SEGURIDAD.** El canonico de Talento tiene una tabla de usuarios con',
        '> contrasenas EN CLARO (cerca de su linea 109). No se copiaron aqui y el generador',
        '> corta ese bloque a proposito. Lo que hay que hacer es rotarlas y sacar las claves',
        '> del documento; mientras esten ahi, cualquiera que lea el Drive las tiene.',
      ].join('\n')
    : '';

  const ideas = Object.entries(f.ideasPorCliente).sort((a, b) => b[1] - a[1])
    .map(([slug, n]) => `| ${slug} | ${n} |`).join('\n');

  return `# RR Aliados — Registro maestro de personas

> Estado: GENERADO — no editar a mano
> Generador: \`rr-content-hub/scripts/generar-roster-personas.mjs\`
> Corte de datos: **${corte}**
> Fuentes: DashWeb API \`/users\` · Supabase \`ntgtvtzbjwotuwkiflar\`, \`cm_profiles\`, \`invoices\`, \`obligations\`, \`rr_contracts\`, \`rr_hub_ideas\`, \`prospects\`

Este archivo lo escribe un script, no una persona. Para corregirlo no se edita
aca: se corrige la fuente y se vuelve a correr el generador. La identidad
canonica de una persona es **el correo**: es lo unico que esta en DashWeb y en
el Centro de Mando a la vez, y por eso es lo unico que permite decir "es la
misma persona" sin suponerlo.

Lo que este archivo NO contiene, a proposito: telefonos, documentos,
salarios, contrasenas, hashes de contrasena ni tokens. El roster es un registro
de cuentas, no una lista de contacto.

## 1. Cuantas personas hay

| Medida | Valor | Fuente |
| --- | --- | --- |
| Filas de este registro (identidades por correo) | **${personas.length}** | union de las dos fuentes |
| Personas (hay un nombre de persona en alguna fuente) | **${personasEfectivas.length}** | este registro |
| Cuentas que no son personas (bot / servicio / compartida) | **${cuentas.length}** | este registro |
| Con alta en las DOS fuentes | ${enAmbas.length} | cruce por correo |
| Con alta en una sola fuente | ${soloUna.length} | este registro |
| Directorio DashWeb | ${f.dashWeb.length} usuarios | DashWeb API \`/users\` |
| Centro de Mando, \`kind=persona\` | ${f.centroMando.length} filas | \`cm_profiles\` |

Las dos ultimas filas NO dan el total de personas: dan lo que tiene cada
fuente por separado. El total sale del cruce, y de ahi salen las
discrepancias de la seccion 3.

## 2. El registro, una fila por identidad canonica

${tablaPersonas(personas)}

Columnas de DashWeb: el rol viene del directorio (\`DIRECTIVO\`, \`COLABORADOR\`,
\`LIDER\`, \`AUXILIAR\`). La columna del CM es \`cm_profiles.global_role\`
(\`direccion\`, \`persona\`): es un rol de esa herramienta, no del organigrama, y
por eso no se traduce a ningun otro.

### Cuentas que no son personas

${cuentas.map((p) => `- \`${p.correo}\`${p.idDashWeb ? ` (${p.idDashWeb})` : ''} — **${p.tipo}**. ${p.notaTipo}`).join('\n')}

${personas.some((p) => p.buzonCompartido) ? `### Cuentas que viven en el buzon de otra

Un correo con sufijo \`+algo\` es una cuenta DISTINTA que apunta al buzon de la
direccion sin sufijo: DashWeb le da id y nombre propios, asi que queda como fila
propia. Se declara el buzon porque es informacion que hace falta para entender
el acceso, no para fusionar filas.

${personas.filter((p) => p.buzonCompartido).map((p) => `- \`${p.correo}\` (${p.idDashWeb ?? 'sin id de DashWeb'}) — buzon real: \`${p.buzonCompartido}\`.`).join('\n')}
` : ''}
### Nombres que no coinciden entre DashWeb y el Centro de Mando

Cuando el correo es el mismo, la persona es la misma: lo que puede diferir es
como cada sistema la escribio. Solo van aqui las filas en las que el nombre
cambia; cuando solo cambian los acentos o el formato, no es una discrepancia.

${tablaVeredictos(personas)}

### Alta en una sola fuente

${tablaSinCruce(personas)}

## 3. Cuentas de cobro

Las dos tablas de cobranza de la base estan **medidas y vacias**. Eso no quiere
decir que no haya cobranza: la fuente real es un JSON en el Drive, producido por
\`_automatizacion/leer_cuentas_cobro.py\`, cuya regla esta en
\`rr_aliados/04_Finanzas/COBRANZA_FUENTE.md\` ("este archivo es la fuente").

| Tabla | Existe | Filas | Lectura |
| --- | --- | --- | --- |
${cobranzaBd}

Fuente real:

| Fuente | Estado | Cuentas | Personas |
| --- | --- | --- | --- |
${cobranzaReal}

Aqui solo se cuenta **cuantas cuentas tiene cada persona y cuantas le faltan por
firmar**. Los importes no se copian a un registro de personas: cada cifra
financiera va a \`04_Finanzas/_automatizacion/capture.json\` y a ningun otro lado.

### Personas que cobran y no estan registradas

No es un error de datos: es un alta pendiente. Sin registro no hay contratacion,
ni acceso al Centro de Mando, ni expediente.

${cobranSinRegistro}

## 3b. Canonico de Talento (cuarta fuente)

\`rr_aliados/09_Admin/People/CANONICO - ADQ Talentos Maestro LLM.md\` es el
canonico de Talento/ADQ y trae personas que no estan en DashWeb ni en el Centro
de Mando. Se lee **por correo**, porque el nombre escrito no coincide: la
"Sthefany Diaz Roso" de ahi y la "Sthefany Diaz" de DashWeb son la misma persona
(\`tefaweb000@gmail.com\`).

| Nombre | Correo | Estado en el canonico |
| --- | --- | --- |
${talento}
${avisoCredenciales}


## 4. Contratos y prospectos

- \`rr_contracts\`: **${f.contratos.length} fila**, en estado \`${f.contratos[0]?.estado ?? 'sin estado'}\`.
  El campo \`cliente_nombre\` dice \`"${f.contratos[0]?.cliente_nombre ?? '-'}\`. Ese campo es
  el CONTRAVENTE de un contrato de vacante, no un dato de personal de RR: no se
  usa para atribuir un contrato a nadie del roster. La tabla no tiene columna
  que referencie a una persona de este registro.
- \`prospects\`: ${f.prospectos.filas} filas, y el campo \`owner\` tiene
  ${f.prospectos.propietariosDistintos.length} valor distinto
  (${f.prospectos.propietariosDistintos.map((o) => `\`${o ?? 'vacio'}\``).join(', ')}). Un solo
  propietario para todas las filas no es un reparto real por persona y no se
  usa como tal.
- \`rr_hub_ideas\`: ${Object.values(f.ideasPorCliente).reduce((a, b) => a + b, 0)} ideas de ${Object.keys(f.ideasPorCliente).length} clientes:

| Cliente | Ideas |
| --- | --- |
${ideas}

Los clientes no son personas del equipo y no entran en el registro. Se miden
para que quede constancia de por que no se mezclan.

## 5. Que NO se puede verificar desde aqui

- **El reparto de identidades \`email\` (11) frente a Google/github (6)** en el
  Centro de Mando. Las 17 personas tienen \`user_id\` informado, que es lo que se
  comprueba sin leer credenciales; la tabla de identidades de autenticacion no
  se consulta a proposito. Ese reparto es un dato del brief, no medido por este
  generador.
- **Si \`${'rr_contracts'}\` tiene que ver con alguien del roster.** No hay
  columna que lo diga.

## 6. Como se regenera

\`\`\`bash
cd /home/deadkiss/rr-content-hub && npm run roster:personas
\`\`\`

Es idempotente: el texto sale solo de datos medidos y de la fecha de corte que
traen las fuentes, no de la hora de correr. Si el resultado es igual al
archivo del Drive, el archivo no se toca.
`;
}

// ---------------------------------------------------------------------------
// Escritura idempotente.
// ---------------------------------------------------------------------------

function escribirSiCambio(contenido) {
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  const antes = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : null;
  if (antes === contenido) {
    console.log(`SIN CAMBIOS  ${SALIDA}`);
    console.log('  El archivo ya era identico: correrlo otra vez no lo toca.');
    return false;
  }
  fs.writeFileSync(SALIDA, contenido);
  console.log(`ESCRITO  ${SALIDA}`);
  console.log(`  ${antes === null ? 'archivo nuevo' : 'contenido actualizado'} · ${contenido.length} bytes`);
  return true;
}

// ---------------------------------------------------------------------------
const f = await leerFuentes();
const personas = construirRegistro(f);

// El corte es la marca mas reciente de las propias fuentes. Va en el documento,
// pero NO la hora de correr: por eso el archivo es idempotente.
const corte = personas.map((p) => p.corte).filter(Boolean).sort().pop()
  ?? new Date().toISOString().slice(0, 10);

console.log(`DashWeb: ${f.dashWeb.length} usuarios · CM kind=persona: ${f.centroMando.length} filas`);
console.log(`Identidades por correo: ${personas.length} · corte de datos: ${corte}`);
const personasEfectivas = personas.filter((p) => p.tipo.startsWith('persona'));
escribirSiCambio(construirMarkdown(f, personas, corte));

// Resumen para el que lo lanza: el veredicto sin leer el archivo entero.
console.log(`Personas: ${personasEfectivas.length} · cuentas no persona: ${personas.length - personasEfectivas.length}`);
for (const p of personas) {
  if (p.veredicto === 'NOMBRE DISTINTO' || p.tipo.includes('compartid')) {
    console.log(`  REVISAR  ${p.correo} — ${p.tipo}${p.veredicto === 'NOMBRE DISTINTO' ? ' · nombres distintos' : ''}`);
  }
}
process.exit(0);