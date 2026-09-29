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

  it('valida el destino contra la lista de clientes conocidos', () => {
    // Sin esto, un `{"proyecto":"inventado"}` crearía una sesión con un slug que
    // no existe y la navegación se quedaría sin rutas.
    expect(ruta).toMatch(/CLIENTES_CONOCIDOS/);
    expect(ruta).toMatch(/status:\s*404/);
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
    expect(componente).toMatch(/SIN ACCESO/);
  });

  it('no pone un enlace en un cliente sin acceso', () => {
    // El candado es `<div aria-disabled>`, no un `<Link>`. Si algún día se
    // convierte en enlace, un cliente sin fila de acceso se abre en el
    // navegador aunque el servidor lo rechace: se ve un tablero y luego un 404.
    const bloqueCerrado = componente.slice(componente.indexOf('SIN ACCESO'));
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

  it('solo ofrece clientes de la lista corta, aunque tengan fila de acceso', () => {
    // Satiro y Boga existen con sus accesos pero no tienen código: salen con
    // candado. Añadirlos a `CLIENTES_CONOCIDOS` es lo único que haría falta
    // cuando tengan.
    const data = leer('lib/data.ts');
    const bloque = data.slice(data.indexOf('export async function getClientesDeLaPersona'));
    expect(bloque).toMatch(/isVisibleProject/);
  });
});
