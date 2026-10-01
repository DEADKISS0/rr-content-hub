/**
 * Cuántos intentos de puerta caben, y cuándo se vuelve a abrir.
 *
 * MEDIDO 2026-10-01 (auditoría de seguridad): `/api/entrar` no tenía ningún
 * control de tasa. El comentario del archivo decía, con razón, que un 401
 * uniforme evita el oráculo del código — y es cierto para UNA respuesta, pero
 * no sobre 10.000. Cuatro dígitos son diez mil: `for i in $(seq 1111 2222)`
 * los prueba todos en un segundo y un 200 delata el bueno.
 *
 * Por qué un módulo y no un `if` en la ruta: la regla tiene que ser
 * comprobable. Con un contador dentro del handler lo único que se puede
 * probar es que el handler existe.
 *
 * Por qué memoria y no tabla: un atacante que tumbe la memoria lo reinicia y
 * pierde la cuenta, y eso no es un ataque nuevo, es reiniciar el proceso. Una
 * tabla en la base exigiría escribir en cada intento fallido, o sea darle al
 * atacante una vía de escritura para protegerse de él.
 *
 * El límite es POR ORIGEN, no global: si lo fuera, bastarían unas pocas
 * peticiones de cualquiera para dejar la puerta cerrada a todo el equipo, y eso
 * sí sería un ataque de denegación.
 */

/** Intentos fallidos que se permiten antes de frenar. */
export const INTENTOS_MAXIMOS = 8;

/** Ventana de la cuenta. Después, la cuenta vuelve a cero. */
export const VENTANA_MS = 15 * 60 * 1000;

type Registro = { fallos: number; desde: number; hasta: number };

/**
 * Qué se responde al que se pasó de intentos.
 *
 * El mensaje NO dice "demasiados intentos" con un número: eso le confirma a un
 * atacante que el límite existe y cuánto le queda. Es el mismo 401 que recibe
 * un código equivocado, por la misma razón que ya usa la ruta: un 429
 * distinguible es un oráculo.
 */
export const RESPUESTA_LIMITE = {
  status: 401,
  cuerpo: { error: 'Ese código no abre ningún cliente.' },
} as const;

/** Decisión del límite, sin efectos de lado. */
export function puedeIntentar(registro: Registro | undefined, ahora: number): boolean {
  if (!registro) return true;
  if (ahora >= registro.hasta) return true; // la ventana ya pasó
  return registro.fallos < INTENTOS_MAXIMOS;
}

/** Un intento fallido: suma y recalcula la ventana si toca abrirla de nuevo. */
export function registrarFallo(registro: Registro | undefined, ahora: number): Registro {
  if (!registro || ahora >= registro.hasta) {
    return { fallos: 1, desde: ahora, hasta: ahora + VENTANA_MS };
  }
  return { ...registro, fallos: registro.fallos + 1 };
}

/** Un acierto: la cuenta se borra. El que entra es alguien de verdad. */
export function registrarAcierto(): undefined {
  return undefined;
}

/** Cuántos intentos le quedan, para la cabecera `Retry-After`. */
export function segundosParaReintentar(registro: Registro | undefined, ahora: number): number {
  if (!registro) return 0;
  if (ahora >= registro.hasta) return 0;
  return Math.max(1, Math.ceil((registro.hasta - ahora) / 1000));
}

/**
 * Limpia las cuentas vencidas.
 *
 * Sin esto el mapa crece sin parar: cada origen que falla una vez deja una
 * entrada, y un atacante con 100.000 IP de origen differentes llena la memoria
 * del proceso de basura. Es la misma presión de memoria con forma de fuga lenta.
 */
export function podar(registro: Registro | undefined, ahora: number): boolean {
  return !registro || ahora >= registro.hasta;
}