import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cambiar de cliente sin volver a teclear el código.
 *
 * Santiago lo pidió el 2026-09-29: un selector dentro del hub, con los clientes a
 * los que tu correo tiene acceso y candado en los que no. Antes solo había una
 * forma de pasar de Wundeer a Candilejas: cerrar sesión y teclear el otro código.
 *
 * Estos tests no miden el pixel: comprueban las tres cosas que convierten esto
 * en un cambio de cliente y no en una puerta trasera.
 */
const raiz = join(process.cwd(), 'src');
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');

/** El codigo sin comentarios: un test que busca un nombre lo encuentra en el
 *  comentario que explica por que se borro, y falla cuando esta bien. */
function codigo(ruta: string): string {
  const crudo = leer(ruta);
  return crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
}

describe('la ruta que cambia de cliente', () => {
  const ruta = leer('app/api/cambiar-cliente/route.ts');

  it('exige sesión: sin la cookie no cambia nada', () => {
    // Un endpoint que emite la cookie nueva sin mirar quién llama es una
    // invitación a volver al modelo anterior, donde el código de un cliente se
    // podía probar contra otro.
    expect(ruta).toMatch(/quienEs\(\)/);
    expect(ruta).toMatch(/status:\s*401/);
  });

  it('NO acepta un código: el correo es lo que decide', () => {
    // Esta es la línea que separa "cambiar de cliente" de "teclear otro código".
    // Si alguien mete `codigo` en el body, el selector vuelve a ser la puerta.
    expect(ruta).not.toMatch(/cuerpo\?\.codigo|body\.codigo|codigoCorrecto/);
    expect(ruta).toMatch(/rr_hub_access/);
  });

  it('comprueba que la persona está en la lista blanca y activa', () => {
    // Las tres condiciones, como en el voto. Que alguien se registrara ayer no
    // lo convierte en alguien con acceso a otro cliente.
    expect(ruta).toMatch(/is_team_member/);
    expect(ruta).toMatch(/is_active/);
    expect(ruta).toMatch(/status:\s*403/);
  });

  it('valida el destino contra los clientes que existen DE VERDAD', () => {
    // Sin esto, un `{"proyecto":"inventado"}` crearía una sesión con un slug que
    // no existe y la navegación se quedaría sin rutas.
    //
    // Antes miraba `CLIENTES_CONOCIDOS`, una lista escrita a mano con dos nombres
    // de los cuatro clientes que hay en la base. Ahora pregunta a la base, y por
    // eso el test mira que se llame a `clienteExiste` y no a una constante: si
    // alguien vuelve a escribir la lista en el código, esto falla.
    const c = codigo('app/api/cambiar-cliente/route.ts');
    expect(c).toMatch(/clienteExiste/);
    expect(c).toMatch(/status:\s*404/);
    expect(c).not.toMatch(/CLIENTES_CONOCIDOS/);
  });

  it('firma la cookie igual que la puerta', () => {
    // Si esta ruta usara otros atributos o ninguna firma, la sesión nueva
    // duraría lo que la vieja en vez de lo que debe, y el cambio de cliente
    // serviría para alargar la sesión.
    expect(ruta).toMatch(/crearSesion/);
    expect(ruta).toMatch(/NOMBRE_COOKIE/);
    expect(ruta).toMatch(/httpOnly:\s*true/);
    expect(ruta).toMatch(/secure:\s*process\.env\.NODE_ENV/);
  });

  it('filtra por user_id, NO solo por proyecto', () => {
    // Este fue un bug real de esta misma ruta, medido el 2026-09-29: la
    // consulta iba solo `.in('project.slug', [...])` y devolvía las filas de
    // acceso de los dos clientes, de toda la gente. `find()` se llevaba el rol
    // de la primera fila, que era de otra persona. Tu correo es `owner` en los
    // cuatro clientes y la API respondió `rol: creator`.
    //
    // Un permiso que se concede a la persona equivocada es PEOR que uno que
    // falta: se ve funcionar. Por eso esta comprobación es literal.
    expect(ruta).toMatch(/\.eq\('user_id'/);
    expect(ruta).not.toMatch(/\.in\('project\.slug'/);
  });

  it('el perfil se resuelve antes que la fila de acceso', () => {
    // La segunda consulta depende del `id` de la primera. Lanzarlas juntas
    // obligaba a quedarse sin ese filtro.
    const iPerfil = ruta.indexOf('rr_hub_profiles');
    const iAcceso = ruta.indexOf("from('rr_hub_access')");
    expect(iPerfil).toBeGreaterThan(-1);
    expect(iAcceso).toBeGreaterThan(iPerfil);
  });

  it('devuelve el rol del cliente nuevo, no el anterior', () => {
    // Puedes ser `owner` en un cliente y `client_viewer` en otro. Si la respuesta
    // no dice cuál, la interfaz puede pintar el rol viejo sobre el tablero nuevo.
    expect(ruta).toMatch(/rol:\s*filaDeDestino\.role_in_project/);
    expect(ruta).toMatch(/desde:\s*sesion\.proyecto/);
  });
});

describe('el selector de la interfaz', () => {
  const componente = leer('components/selector-cliente.tsx');

  it('el candado es para lo que existe pero NO se puede abrir', () => {
    // Mostrar solo los que puedes abrir esconde que el otro cliente existe.
    // Mostrarlo todo sin candado invita a pulsar donde no se puede.
    expect(componente).toMatch(/cerrados/);
    expect(componente).toMatch(/name="lock"/);
    expect(componente).toMatch(/NO PUEDES ABRIRLOS/);
  });

  it('no pone un enlace en un cliente sin acceso', () => {
    // El candado es `<div aria-disabled>`, no un `<Link>`. Si algún día se
    // convierte en enlace, un cliente sin fila de acceso se abre en el
    // navegador aunque el servidor lo rechace: se ve un tablero y luego un 404.
    const bloqueCerrado = componente.slice(componente.indexOf('NO PUEDES ABRIRLOS'));
    expect(bloqueCerrado).not.toMatch(/<Link/);
    expect(bloqueCerrado).toMatch(/aria-disabled/);
  });

  it('el cliente abierto no se puede volver a pulsar', () => {
    // Pulsar el que ya está abierto no es cambiar nada, y si la ruta lo tratara
    // como cambio emitiría una cookie nueva para nada.
    expect(componente).toMatch(/aria-selected=\{esActual\}/);
    expect(componente).toMatch(/slug === actual/);
  });

  it('navega con replace y no con push', () => {
    // Con `push`, el botón "atrás" del navegador devolvería al cliente anterior
    // con la cookie ya cambiada, y esa página pediría un cliente al que la
    // sesión ya no tiene acceso.
    expect(componente).toMatch(/router\.replace/);
    expect(componente).not.toMatch(/router\.push/);
  });

  it('el fallo del cambio se ve, y con su motivo', () => {
    // Un error que no se ve es un silencio: la persona pulsa y no pasa nada.
    expect(componente).toMatch(/role="alert"/);
    expect(componente).toMatch(/cuerpo\?\.error/);
  });

  it('un clic fuera o Escape lo cierran', () => {
    // El desplegable pegado tapa el tablero. Es el defecto que ya se corrigió
    // dos veces con la guía guiada.
    expect(componente).toMatch(/mousedown/);
    expect(componente).toMatch(/Escape/);
  });
});

describe('la lista la da el servidor, no el navegador', () => {
  it('el layout pide los clientes en el servidor', () => {
    const layout = leer('app/[projectSlug]/layout.tsx');
    expect(layout).toMatch(/getClientesDeLaPersona/);
    // Y se lo pasa al shell: si no, el selector no aparece y el reporte vuelve.
    expect(layout).toMatch(/clientes=\{clientes\}/);
  });

  it('la lista cruza acceso y proyectos en memoria, sin embed', () => {
    // `rr_hub_access` no tiene FK con `rr_hub_profiles`; un embed devuelve
    // PGRST200 con `data: null` sin lanzar. Ese fallo costó un día entero: todo
    // el equipo en `sin_rol` y la puerta abierta sin transiciones.
    const data = leer('lib/data.ts');
    const bloque = data.slice(data.indexOf('export async function getClientesDeLaPersona'));
    expect(bloque).not.toMatch(/rr_hub_profiles!inner/);
    // El cruce es por `project_id`, que sí es una columna real de las dos.
    expect(bloque).toMatch(/project_id/);
  });

  it('la fila manda sobre el global_role, y sin fila es solo lectura', () => {
    // Lo que este test protegía antes y SIGUE siendo cierto: la fila real de
    // `rr_hub_access` manda sobre el global_role. El bug viejo era `esAdmin ||
    // fila` con `rol: esAdmin ? 'owner'`, que veía a un admin global como owner
    // en clientes donde no tenía fila. Eso no volvió.
    //
    // Lo que SÍ cambió el 2026-10-02 es la puerta: `abiertos` ya no se filtra
    // por fila, porque sin cookie `rolPorProyecto` salía vacío y los cuatro
    // clientes caían a `cerrados`. MEDIDO en producción: la raíz decía
    // "Todavía no tienes un cliente abierto" con todo dado de alta.
    //
    // Entonces el rol por defecto NO es `owner` ni `sin_rol`: es
    // `client_viewer`, el mismo de los visitantes. La fila da el rol si la hay;
    // si no, lectura. Ver un cliente no es escribir en él: eso lo sigue
    // decidiendo `rr_hub_access` en el guard.
    const data = leer('lib/data.ts');
    const bloque = data.slice(data.indexOf('export async function getClientesDeLaPersona'));
    expect(bloque).not.toMatch(/esAdmin/);
    // El rol sale de la fila cuando existe.
    expect(bloque).toMatch(/rolPorProyecto\.get\(p\.id\)/);
    // Y sin fila no es el rol mas alto.
    expect(bloque).not.toMatch(/\?\? 'owner'/);
  });

  it('los cerrados salen del catálogo ENTERO, no de la lista corta', () => {
    // Este era el fallo que dejó el candado siempre vacío: `cerrados` se
    // filtraba sobre `conocidos` (la lista corta), así que Satiro y Boga no
    // aparecían nunca. Un `filter` sobre una lista ya filtrada solo puede
    // devolver lo que ya estaba en ella.
    //
    // Y tiene que ser así: se ven los clientes que existen aunque no se puedan
    // abrir. La puerta sigue exigiendo `CLIENTES_CONOCIDOS` para abrirlos, así
    // que verlos no concede nada.
    const data = leer('lib/data.ts');
    const bloque = data.slice(data.indexOf('export async function getClientesDeLaPersona'));
    const iAbiertos = bloque.indexOf('const abiertos');
    const iCerrados = bloque.indexOf('const cerrados');
    expect(iCerrados).toBeGreaterThan(iAbiertos);
    const seccionCerrados = bloque.slice(iCerrados, bloque.indexOf('return {'));
    expect(seccionCerrados).toMatch(/\.filter\(\(p\) => !slugsAbiertos\.has\(p\.slug\)\)/);
    // Y se filtran sobre el catálogo completo, no sobre `conocidos`.
    expect(seccionCerrados).not.toMatch(/conocidos\s*$/);
    expect(seccionCerrados).not.toMatch(/knowns|conocidos\.filter/);
  });

  it('el candado dice POR QUE esta cerrado, y son dos motivos', () => {
    // Un solo texto miente en uno de los dos casos. Con el motivo unico, una
    // creativa con filas en Wundeer y Candilejas veia "tu correo no tiene
    // acceso" sobre Boga y Satiro. Para ella era verdad, pero el mismo texto
    // tapaba que esos clientes existen con equipo propio y que a otros miembros
    // del equipo si les abre.
    //
    //   sin-fila   → no hay fila. Pidesela.
    //   sin-codigo → hay fila, pero el cliente no tiene codigo de cuatro
    //                digitos, asi que no hay puerta por la que entrar.
    const data = leer('lib/data.ts');
    const componente = leer('components/selector-cliente.tsx');
    expect(data).toMatch(/sin-codigo/);
    expect(data).toMatch(/sin-fila/);
    expect(componente).toMatch(/sin-codigo/);
    // Los dos textos existen y son distintos: uno habla de permisos y el otro
    // de que falta la puerta. Confundirlos hace pedir permisos que ya se tienen.
    expect(componente).toMatch(/Todav[ií]a no tiene c[oó]digo de entrada/);
    expect(componente).toMatch(/Tu correo no tiene acceso/);
  });

  it('la lista de clientes NO vuelve a escribirse en el codigo', () => {
    // Este test existia para que la lista corta siguierauhaciendose cargo. Con la
    // puerta abierta ya no hay lista: la responde la base. Si alguien la vuelve a
    // escribir a mano, BOGA y Satiro volveran a quedar fuera sin avisar, que es
    // exactamente como se rompió la primera vez.
    const c = codigo('app/api/cambiar-cliente/route.ts');
    expect(c).not.toMatch(/CLIENTES_CONOCIDOS/);
    expect(c).toMatch(/clienteExiste/);
  });
});
