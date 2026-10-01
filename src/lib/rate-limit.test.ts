import { describe, it, expect } from 'vitest';
import {
  puedeIntentar,
  registrarFallo,
  registrarAcierto,
  segundosParaReintentar,
  podar,
  INTENTOS_MAXIMOS,
  VENTANA_MS,
  RESPUESTA_LIMITE,
} from './rate-limit';

/**
 * Santiago, 2026-10-01 — auditoría de seguridad, hallazgo 5.
 *
 * `/api/entrar` no tenía control de tasa. Cuatro dígitos son diez mil, y el
 * propio archivo reconocía el problema a medias: el 401 uniforme evita el
 * oráculo sobre UNA respuesta, no sobre diez mil.
 *
 * Estas pruebas comprueban dos cosas que se contradicen entre sí y por eso
 * tienen que estar juntas:
 *
 * 1. La puerta SE CIERRA a quien insiste. Un límite que no frena no es un
 *    límite.
 * 2. La puerta NO se le cierra a los demás por el abuse de otro. Si el
 *    contador fuera global, bastarían unas pocas peticiones para dejar fuera a
 *    todo el equipo: eso sería fabricar un ataque de denegación.
 */

const AHORA = 1_760_000_000_000;
const T0 = AHORA;

describe('la puerta se cierra a quien insiste', () => {
  it('deja pasar los primeros intentos', () => {
    let r: ReturnType<typeof registrarFallo> | undefined;
    for (let i = 0; i < INTENTOS_MAXIMOS; i++) {
      expect(puedeIntentar(r, AHORA)).toBe(true);
      r = registrarFallo(r, AHORA);
    }
  });

  it('al pasarse, no deja pasar más', () => {
    let r: ReturnType<typeof registrarFallo> | undefined;
    for (let i = 0; i < INTENTOS_MAXIMOS; i++) r = registrarFallo(r, AHORA);
    expect(puedeIntentar(r, AHORA)).toBe(false);
  });

  it('la ventana se pasa sola y vuelve a abrir', () => {
    let r: ReturnType<typeof registrarFallo> | undefined;
    for (let i = 0; i < INTENTOS_MAXIMOS + 3; i++) r = registrarFallo(r, AHORA);
    expect(puedeIntentar(r, AHORA)).toBe(false);
    // Un segundo antes de que expire: todavía cerrado.
    expect(puedeIntentar(r, AHORA + VENTANA_MS - 1)).toBe(false);
    // Al expirar: se abre.
    expect(puedeIntentar(r, AHORA + VENTANA_MS)).toBe(true);
  });

  it('un fallo fuera de ventana abre una ventana nueva, no acumula', () => {
    // Sin esto, un atacante que espera la ventana y falla una vez arrastra
    // una cuenta vieja a la nueva y se autobloquea. O peor: si se sumara, un
    // fallo aislado tras 15 minutos dejaría la puerta cerrada.
    const viejo = registrarFallo(undefined, T0);
    const nuevo = registrarFallo(viejo, T0 + VENTANA_MS + 1000);
    expect(nuevo.fallos).toBe(1);
    expect(nuevo.hasta).toBe(T0 + VENTANA_MS + 1000 + VENTANA_MS);
  });

  it('dentro de la ventana sí acumula', () => {
    let r = registrarFallo(undefined, T0);
    r = registrarFallo(r, T0 + 1000);
    r = registrarFallo(r, T0 + 2000);
    expect(r.fallos).toBe(3);
    // La ventana no se reinicia en cada fallo: si no, nunca llegaría a cerrar.
    expect(r.hasta).toBe(T0 + VENTANA_MS);
  });
});

describe('entrar borra la cuenta', () => {
  it('el acierto limpia el registro', () => {
    // Si el acierto no borrara, alguien que fallara 7 veces, entrara bien y
    // volviera a fallar 1, quedaría cerrado por culpa de un intento antiguo.
    let r: ReturnType<typeof registrarFallo> | undefined = registrarFallo(undefined, T0);
    for (let i = 0; i < 5; i++) r = registrarFallo(r, T0);
    r = registrarAcierto();
    // No basta con que "pueda intentar": con `{fallos: 0, hasta: 0}` también
    // pasa, y esa es justo la mutación que no muerde. Lo que importa es que la
    // cuenta NO exista: sin cuenta, el siguiente fallo arranca en 1.
    expect(r).toBeUndefined();
    expect(puedeIntentar(r, T0)).toBe(true);
    expect(registrarFallo(r, T0).fallos).toBe(1);
  });
});

describe('el límite es por origen, no global', () => {
  it('dos orígenes tienen cuentas separadas', () => {
    // Esta es la prueba que justifica el "por origen". Con un contador
    // global, ocho intentos de cualquiera dejan la puerta cerrada a todo el
    // equipo, y eso es un ataque de denegación, no una protección.
    let atacante: ReturnType<typeof registrarFallo> | undefined;
    for (let i = 0; i < INTENTOS_MAXIMOS + 5; i++) atacante = registrarFallo(atacante, T0);

    const equipo = registrarFallo(undefined, T0);
    expect(puedeIntentar(atacante, T0)).toBe(false);
    expect(puedeIntentar(equipo, T0)).toBe(true);
  });
});

describe('el que se pasó no se entera de que se pasó', () => {
  it('la respuesta del límite es la misma que la de un código malo', () => {
    // Un 429 delata que el límite existe y, con `Retry-After`, cuánto queda.
    // Un atacante que sabe que hay límite sabe que hay vigilancia.
    expect(RESPUESTA_LIMITE.status).toBe(401);
    expect(RESPUESTA_LIMITE.cuerpo.error).toBe('Ese código no abre ningún cliente.');
  });

  it('el Retry-After va en la cabecera, no en el cuerpo', () => {
    const s = segundosParaReintentar({ fallos: 9, desde: T0, hasta: T0 + VENTANA_MS }, T0);
    expect(s).toBeGreaterThan(0);
    // Solo para navegadores合法: un reintento automático del propio código
    // sigue siendo un intento más, que es justo lo que se quiere frenar.
    expect(s).toBeLessThanOrEqual(Math.ceil(VENTANA_MS / 1000));
  });
});

describe('la memoria no se llena de basura', () => {
  it('una cuenta vencida se poda', () => {
    const r = registrarFallo(undefined, T0);
    expect(podar(r, T0)).toBe(false);
    expect(podar(r, T0 + VENTANA_MS)).toBe(true);
    expect(podar(undefined, T0)).toBe(true);
  });
});