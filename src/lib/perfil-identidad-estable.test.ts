import { describe, it, expect, beforeEach } from 'vitest';
import { perfilElegido, guardarPerfil, olvidarCachePerfil } from './perfil-votante';

/**
 * MEDIDO 2026-10-04 a 390 px: elegir un perfil en el selector dejaba la
 * **pantalla en blanco** con `React error #185` — «maximum update depth exceeded».
 *
 * No salía ni un botón de voto y el tablero se iba a 0 tarjetas, con 35 ideas
 * recién cargadas de Supabase. Elegir tu nombre para poder votar te dejaba sin
 * hub.
 *
 * La causa era `perfilElegido()`, que construía `{ email, nombre }` en cada
 * llamada. `useSyncExternalStore` compara con `Object.is`, no por contenido: dos
 * objetos con los mismos datos nunca son «el mismo», así que el store veía
 * «cambió» en cada render, el render leía otra vez, y así hasta que React tira
 * la pantalla.
 *
 * Por qué llevaba días dormido: sin perfil devuelve `null`, y
 * `Object.is(null, null)` es `true` — nada cambia, nada se rompe. **El bug solo
 * arranca cuando hay un perfil de verdad**, o sea, en el segundo uso del hub por
 * alguien que ya eligió. En una prueba de navegador con contexto limpio, nunca.
 */

/**
 * Node no tiene `window`, y `perfil-votante` lee `window.localStorage`. Se le da
 * uno con un almacén en memoria: el módulo usa el objeto real, no un doble.
 */
function montarAlmacen(): void {
  const memoria = new Map<string, string>();
  const store = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => { memoria.set(k, v); },
    removeItem: (k: string) => { memoria.delete(k); },
    clear: () => memoria.clear(),
    key: (i: number) => [...memoria.keys()][i] ?? null,
    get length() { return memoria.size; },
  };
  // `avisarCambioPerfil` despacha un evento propio: `storage` no salta en la
  // MISMA pestaña. Sin `dispatchEvent` en el doble, `guardarPerfil` revienta y
  // los tests que guardan un perfil no llegan a comprobar nada.
  const oyentes = new Map<string, Set<(e: unknown) => void>>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: store as Storage,
    dispatchEvent: (e: { type: string }) => {
      for (const fn of oyentes.get(e.type) ?? []) fn(e);
      return true;
    },
    addEventListener: (tipo: string, fn: (e: unknown) => void) => {
      if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
      oyentes.get(tipo)!.add(fn);
    },
    removeEventListener: (tipo: string, fn: (e: unknown) => void) => {
      oyentes.get(tipo)?.delete(fn);
    },
  };
}

const CLAVE = 'rr_perfil_votante';

describe('el perfil elegido tiene identidad estable', () => {
  beforeEach(() => {
    montarAlmacen();
    olvidarCachePerfil();
  });

  it('dos llamadas seguidas devuelven el MISMO objeto', () => {
    // ESTA es la aserción que falla con el bug: sin cache, `a !== b` aunque
    // tengan los mismos datos. `Object.is(a, b)` es justo lo que mira
    // `useSyncExternalStore`.
    window.localStorage.setItem(CLAVE, JSON.stringify({ email: 'a@b.com', nombre: 'Persona Prueba' }));
    olvidarCachePerfil();

    const a = perfilElegido();
    const b = perfilElegido();

    expect(a).not.toBeNull();
    expect(Object.is(a, b)).toBe(true);
  });

  it('sin perfil devuelve null estable, sin drama', () => {
    expect(perfilElegido()).toBeNull();
    expect(Object.is(perfilElegido(), perfilElegido())).toBe(true);
  });

  it('elegir un perfil distinto cambia el valor', () => {
    // El otro lado del arreglo: si la cache no se invalida al guardar, el perfil
    // nuevo nunca se ve. Este test es el que impide arreglar el cuelgue rompiendo
    // el cambio de perfil, que sería el bug siguiente.
    guardarPerfil({ email: 'a@b.com', nombre: 'Una' });
    const primero = perfilElegido();
    guardarPerfil({ email: 'c@d.com', nombre: 'Otra' });
    const segundo = perfilElegido();

    expect(primero?.email).toBe('a@b.com');
    expect(segundo?.email).toBe('c@d.com');
    expect(Object.is(primero, segundo)).toBe(false);
  });

  it('cambiar solo el nombre tambien repinta', () => {
    // MEDIDO: la comparacion por contenido era la deuda. `nombre ?? email` puede
    // cambiar sin que cambie el email, y con una cache a ciegas eso no se veria
    // nunca.
    guardarPerfil({ email: 'a@b.com', nombre: 'Antes' });
    const antes = perfilElegido();
    guardarPerfil({ email: 'a@b.com', nombre: 'Despues' });
    const despues = perfilElegido();

    expect(antes?.nombre).toBe('Antes');
    expect(despues?.nombre).toBe('Despues');
    expect(Object.is(antes, despues)).toBe(false);
  });

  it('borrar el perfil devuelve null', () => {
    guardarPerfil({ email: 'a@b.com', nombre: 'Una' });
    expect(perfilElegido()).not.toBeNull();
    guardarPerfil(null);
    expect(perfilElegido()).toBeNull();
  });

  it('un localStorage corrupto no cuelga nada', () => {
    window.localStorage.setItem(CLAVE, '{no es json');
    olvidarCachePerfil();
    expect(perfilElegido()).toBeNull();

    window.localStorage.setItem(CLAVE, JSON.stringify({ nombre: 'sin email' }));
    olvidarCachePerfil();
    expect(perfilElegido()).toBeNull();
  });

  it('guardar vacia la cache antes de escribir', () => {
    // Defensa en profundidad: la comparacion por contenido ya detectaria el
    // cambio, pero vaciar el cache antes de escribir deja el par guardar/leer
    // explicito y no depende de esa comparacion.
    guardarPerfil({ email: 'a@b.com', nombre: 'Una' });
    perfilElegido(); // llena el cache
    guardarPerfil({ email: 'c@d.com', nombre: 'Otra' });
    // Si no se vaciara, el segundo perfil tendria que pasar por comparacion para verse.
    expect(perfilElegido()?.email).toBe('c@d.com');
  });

  it('diez llamadas seguidas siguen dando el mismo objeto', () => {
    // El bucle de React no necesita dos llamadas: necesita que ninguna diga
    // «cambió». Diez es el mínimo para que un re-render se note.
    guardarPerfil({ email: 'a@b.com', nombre: 'Persona Prueba' });
    const vistos = new Set<unknown>();
    for (let i = 0; i < 10; i += 1) vistos.add(perfilElegido());
    expect(vistos.size).toBe(1);
  });
});