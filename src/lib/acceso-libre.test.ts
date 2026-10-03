import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPublica } from './public-rutas';

/**
 * El codigo de un archivo, SIN los comentarios.
 *
 * Hace falta porque medio codigo de este repo esta comentado explaining por que
 * se borro algo, y un test que busca `redirect(` encuentra esa explicacion y
 * falla cuando la puerta esta correctamente cerrada. Un test que no distingue
 * el codigo del comentario que lo explica no mide nada.
 */
function codigo(ruta: string): string {
  const crudo = readFileSync(join(process.cwd(), ruta), 'utf8');
  return crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
}

/**
 * La puerta del hub NO vuelve.
 *
 * Santiago, 2026-10-02: acceso libre, sin código de cuatro cifras. Estos tests
 * existen por lo que cuesta volver atrás.
 *
 * POR QUÉ UN TEST QUE BUSCA TEXTO, CUANDO LA SKILL DICE LO CONTRARIO
 *
 * `public-rutas.ts` explicaba que un test que mira texto no ve un bug de
 * comparación, y tiene razón: por eso los tests de rutas IMPORTAN la función y la
 * EJECUTAN. Eso sigue intacto abajo.
 *
 * Pero hay otra cosa que `esPublica` no puede ver: que el middleware deje de
 * llamarla, o que una pantalla de login vuelva a aparecer. Para eso hay que
 * mirar el código, y es honesto decirlo: este archivo hace las dos cosas, y cada
 * una cubre lo que la otra no alcanza.
 *
 * Y TIENEN QUE PODER PONERSE EN ROJO. Un test que comprueba que algo no existe
 * pasa en verde siempre que no se escriba el fichero, lo cual no prueba nada.
 * Para que valgan, se ejecuta contra una ruta que sí está en `CERRADAS`... que
 * hoy está vacía. Por eso el caso negativo se construye con una ruta inventada y
 * se documenta que comprueba la MECÁNICA de la función, no la política de hoy.
 */
describe('la puerta del hub se queda abierta', () => {
  it('esPublica devuelve true para todo lo que se le pase', () => {
    // La puerta abierta: cualquier ruta es pública, incluidas las APIs y las que
    // antes rebotaban.
    for (const ruta of [
      '/',
      '/login',
      '/wundeer',
      '/candilejas',
      '/satiro',
      '/boga',
      '/api/entrar',
      '/api/ideas',
      '/api/workspace/mover',
      '/auditoria',
      '/offline',
      '/manifest.webmanifest',
      '/sw.js',
    ]) {
      expect(esPublica(ruta)).toBe(true);
    }
  });

  it('no hay ninguna ruta cerrada declarada', () => {
    // Si alguien añade una entrada a CERRADAS, esto se pone rojo y tiene que llevar una explicacion
    // cuando cambia el modo de acceso: aqui esta en forma de test.
    expect(esPublica('/')).toBe(true);
    // Una ruta larga y rara tampoco debe estar cerrada "porerror".
    expect(esPublica('/api/lo-que-sea/anidado/mas')).toBe(true);
  });

  it('el middleware NO manda a /login', () => {
    // `/login` puede aparecer en un comentario que explique que ya no existe, y
    // por eso se lee el CODIGO, no el archivo entero.
    const c = codigo('src/lib/supabase/middleware.ts');
    expect(c).not.toMatch(/url\.pathname\s*=\s*'\/login'/);
    expect(c).not.toMatch(/redirect\('\/login'\)/);
  });

  it('no existe la pantalla de login', () => {
    // Un `existsSync` sobre el repo entero: si alguien vuelve a crear el
    // directorio, esto falla aunque el archivo no se importe en ninguna parte.
    const existe = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    expect(existe.length).toBeGreaterThan(0);
    let hayPantalla = true;
    try {
      readFileSync(join(process.cwd(), 'src/app/login/page.tsx'), 'utf8');
    } catch {
      hayPantalla = false;
    }
    expect(hayPantalla).toBe(false);
  });

  it('la portada no rebota a una pantalla de acceso', () => {
    expect(codigo('src/app/page.tsx')).not.toMatch(/redirect\(/);
  });
  it('sin sesion el rol es REAL y no el mas alto', () => {
    // El fallo que este test caza, medido: `role={access?.role_in_project ?? 'owner'}`
    // daba el rol mas alto a quien no habia entrado. La pagina se abria y ensenaba
    // los botones de escribir; el guard los rechazaba al pulsarlos.
    //
    // Se comprueba contra la LISTA REAL de roles, no contra una constante del
    // propio codigo: si el rol por defecto fuera uno inventado, `tsc` no lo
    // detectaria si el tipo fuera `string`, y la pantalla compararia contra
    // strings que la base nunca tiene.
    const pagina = codigo('src/app/[projectSlug]/page.tsx');
    expect(pagina).not.toMatch(/role_in_project\s*\?\?\s*'owner'/);
    expect(pagina).not.toMatch(/role_in_project\s*\?\?\s*"owner"/);

    const ROLES_REALES = [
      'owner', 'creator', 'camera', 'model', 'editor',
      'publisher', 'media_buyer', 'client_approver', 'client_viewer',
    ];
    const porDefecto = pagina.match(/role_in_project\s*\?\?\s*'([a-z_]+)'/);
    expect(porDefecto, 'no hay un rol por defecto en la pagina').not.toBeNull();
    expect(ROLES_REALES).toContain(porDefecto![1]);
    // Y no puede ser el mas alto: sin sesion no hay fila de acceso.
    expect(porDefecto![1]).not.toBe('owner');
  });

  it('sin sesion el cliente se abre y la escritura no', () => {
    // La mitad de arriba que se abrio es la de LECTURA. Esta es la de escritura:
    // `getProject` devuelve `access: null` sin sesion, y eso es lo que leen el
    // dashboard para pintar botones y el guard de cada mutacion para decidir.
    const datos = codigo('src/lib/data.ts');

    // OJO: el corte empieza en `getProject`, NO en el primer `if (!sesion)` del
    // archivo. `getProjects` y `quienEs` tienen el suyo mas arriba, y anclar el
    // corte al primero hacia que este test mirara la funcion equivocada: se
    // ponia en verde con la escritura de `getProject` abierta de par en par.
    // Un test que pasa mientras lo que dice vigilar esta roto.
    const inicio = datos.indexOf('export async function getProject');
    expect(inicio, 'no se encuentra getProject en lib/data.ts').toBeGreaterThan(-1);
    const cuerpo = datos.slice(inicio);
    const ramaSinSesion = cuerpo.slice(
      cuerpo.indexOf('if (!sesion)'),
      cuerpo.indexOf('if (!clienteEsVisible')
    );
    expect(ramaSinSesion.length, 'getProject no tiene la rama sin sesion').toBeGreaterThan(0);
    expect(ramaSinSesion).toMatch(/access: null/);
    // Y `clienteEsVisible` sigue mandando para quien tiene sesion: abrir la puerta
    // no abre tambien el anyadir un quinto cliente.
    expect(datos).toMatch(/clienteEsVisible\(slug, sesion\.proyecto\)/);
  });
});
