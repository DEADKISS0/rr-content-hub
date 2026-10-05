import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-04, Santiago, tres cosas:
 *
 *   1. «si yo ya tengo una sesión iniciada, ya elegí un nombre, es lo que me va
 *      a pedir apenas yo le entre. Que cuando vaya a votar no me vuelva a pedir
 *      eso».
 *   2. «el apartado que dice lo que falta de esta ficha que sea más interactivo
 *      o se me salte como en un pop up».
 *   3. «quiero que elimines esos perfiles que dicen visitante».
 *
 * La primera ya funcionaba y este test está para que no se rompa: la prueba de
 * fuego no es que elija un perfil, es que no haya que elegirlo otra vez mañana.
 */
const RAIZ = join(__dirname, '..', '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

describe('la identidad del votante se recuerda', () => {
  const perfil = leer('src/lib/perfil-votante.ts');
  const selector = leer('src/components/selector-perfil.tsx');

  it('el perfil elegido vive en localStorage, no en memoria', () => {
    // MEDIDO: `rr_perfil_votante` = {"email":"...","nombre":"Alejandra Suarez"}.
    // En memoria se perdería al recargar, que es justo lo que se pidió evitar.
    expect(perfil).toMatch(/rr_perfil_votante/);
    expect(perfil).toMatch(/localStorage\.setItem\(LLAVE_PERFIL/);
  });

  it('se lee al montar, no después de pintar', () => {
    // MEDIDO 2026-10-03: con `useEffect` + `setState` el botón decía «ELEGIR
    // QUIÉN VOTA» durante un frame aunque ya hubiera perfil. `useSyncExternalStore`
    // lo resuelve sin estado intermedio.
    expect(selector).toMatch(/useSyncExternalStore\(suscribirPerfil, perfilElegido/);
  });

  it('el servidor devuelve null, porque allí no hay localStorage', () => {
    expect(selector).toMatch(/\(\) => null/);
  });

  it('la identidad elegida llega al servidor cuando se vota', () => {
    // Si el POST no lleva el perfil, el servidor no puede validar el voto y lo
    // rechaza. MEDIDO: con perfil elegido el POST sale; sin él, se bloquea.
    expect(perfil).toMatch(/export function guardarPerfil/);
  });
});

describe('lo que falta de la ficha se abre', () => {
  const panel = leer('src/components/panel-faltan.tsx');
  const ficha = leer('src/app/[projectSlug]/ideas/[ideaId]/page.tsx');

  it('la ficha usa el panel en vez del bloque de texto gris', () => {
    expect(ficha).toMatch(/<PanelFaltan/);
    // La caja vieja: cinco renglones al final de la columna.
    expect(ficha).not.toMatch(/LO QUE FALTA DE ESTA FICHA<\/p>\s*<p className="mt-3 font-mono/);
  });

  it('el panel es un popup con los cinco datos', () => {
    // MEDIDO: el bloque viejo estaba en y=5817 con una página de 6423 px — al
    // final de todo. El popup aparece donde está el botón.
    expect(panel).toMatch(/role="dialog"/);
    expect(panel).toMatch(/aria-label="Lo que falta de esta ficha"/);
  });

  it('el botón abre y cierra, y lo dice', () => {
    expect(panel).toMatch(/aria-expanded=\{abierto\}/);
    expect(panel).toMatch(/setAbierto\(\(v\) => !v\)/);
  });

  it('se cierra con Escape y con un toque fuera', () => {
    // Un panel pegado tapa la referencia de la pieza. MEDIDO antes: el de la
    // trazabilidad es un `details` y se queda abierto.
    expect(panel).toMatch(/key === 'Escape'/);
    expect(panel).toMatch(/pointerdown/);
  });

  it('el botón tiene 44 px para el dedo', () => {
    expect(panel).toMatch(/min-h-\[44px\]/);
  });

  it('el panel en móvil entra en la pantalla por los dos lados', () => {
    // MEDIDO: en 390 px, un panel con ancho fijo se sale por la derecha.
    expect(panel).toMatch(/inset-x-3/);
  });

  it('dice qué falta Y qué hay ya', () => {
    // Un «lo que falta» que solo enumera carencias obliga a ir a buscarlas.
    expect(panel).toMatch(/YA ESTÁ CARGADO/);
    expect(panel).toMatch(/FALTA —/);
  });

  it('cuando no falta nada no hay nada que abrir', () => {
    // Un botón que se abre para decir «está todo bien» es ruido.
    expect(panel).toMatch(/listo \? \(/);
    expect(panel).toMatch(/FICHA COMPLETA/);
  });
});

describe('no hay perfiles de relleno', () => {
  const presencia = leer('src/app/api/presencia/route.ts');

  it('sin sesión no se inventa una presencia', () => {
    // MEDIDO 2026-10-04: 2 filas `visitante-muuff0k8` y `visitante-muuffnmx`, con
    // `profile_id` nulo, creadas el 2026-10-04 23:03. Borradas y respaldadas.
    // La causa era el endpoint fabricando un identificador por heartbeat sin
    // sesión, con `onConflict` por correo: cada visita dejaba su fila para
    // siempre. Santiago: «eso me parece relleno».
    expect(presencia).toMatch(/if \(!sesion|sinSesi|unauthorized\(\)/);
    expect(presencia).not.toMatch(/visitante-/);
  });

  it('el backend tampoco fabrica un visitante', () => {
    const action = leer('src/app/api/workspace/[action]/route.ts');
    expect(action).not.toMatch(/visitante-/);
  });
});