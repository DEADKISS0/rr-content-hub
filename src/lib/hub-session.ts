/**
 * La puerta del hub: un código de cuatro dígitos por cliente.
 *
 * Decisión de Santiago (2026-09-28): fuera el acceso por correo. Entra quien
 * teclee el código del cliente. Wundeer 1111, Candilejas 2222.
 *
 * Lo que cambia y lo que NO cambia:
 *
 * - **Cambia quién es la persona.** Antes la identidad venía de una sesión de
 *   Supabase: un correo, un id de auth, una fila en `auth.users`. Ahora es un
 *   nombre de persona dentro de un proyecto, guardado en una cookie firmada.
 *   No hay correos, ni contraseñas, ni `auth.uid()`, ni tabla de identidades.
 *
 * - **NO cambia quién puede hacer qué.** Eso ya estaba resuelto con listas
 *   positivas en `flow.ts` y una fila en `rr_hub_access`, y se queda igual. El
 *   código abre la puerta del cliente; el rol de cada persona dentro de él sigue
 *   mandando sobre lo que puede escribir. Sacar la autenticación no significa
 *   abrirlo: significa que la puerta es más simple.
 *
 * - **NO cambia el voto.** Votar sigue exigiendo `is_team_member` Y
 *   `is_active` en `rr_hub_can_vote_by_email()`. Con la puerta por código no
 *   hay correo de sesión, así que el voto se atribuye a la persona que eligió
 *   en la pantalla de acceso, y el servidor comprueba que esa persona sea del
 *   equipo antes de contar el voto.
 *
 * Por qué un código y no un correo con clave o un código de un uso:
 *
 * - Un código de cuatro dígitos se teclea en dos segundos con el móvil en la
 *   mano, y no se olvida: nadie recuerda una contraseña, pero "Wundeer es 1111"
 *   se lo sabe cualquiera que haya entrado una vez.
 *
 * - Es por cliente, no por persona: la puerta es la casa, y dentro de cada
 *   cliente se entra con el rol que la persona tenga. Así una persona que hoy
 *   está en Wundeer mañana puede estar en Candilejas sin que Dirección tenga que
 *   tocar nada.
 *
 * Lo que este archivo NO hace, a propósito:
 *
 * - No guarda el código en el código. Los de cada cliente se leen de
 *   `rr_hub_projects.access_code`, que Dirección edita desde `/audit/admin`. Un
 *   código escrito en el bundle de JavaScript lo lee cualquiera que abra las
 *   herramientas del navegador, y con eso el hub no tiene puerta: se entra
 *   escribiendo cuatro números que ya están publicados.
 *
 * - No lo acepta como número suelto. El cliente entra con un código Y con su
 *   nombre de persona, y el servidor comprueba que esa persona esté en la fila
 *   de acceso de ESE proyecto. Un código sin nombre no abre nada: sin nombre no
 *   hay quien registre el voto, y sin voto no hay a quién preguntarle si la pieza
 *   estaba bien.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Un acceso: quién entró, en qué cliente, y desde cuándo. */
export type SesionHub = {
  /** Nombre de la persona, tal como aparece en `rr_hub_profiles.full_name`. */
  nombre: string;
  /** Correo de esa persona. No es una cuenta: es cómo se le reconoce. */
  email: string;
  /** Slug del cliente. `wundeer`, `candilejas`, … */
  proyecto: string;
  /** Momento de la entrada, para la presencia del tablero. */
  desde: string;
};

const COOKIE = 'hub_sesion';
const FIRMA = process.env.HUB_SECRET ?? 'hub-candilejas-wundeer-2026';
const DIAS = 30;

/**
 * La cookie va firmada. Sin firma, `document.cookie` deja escribir cualquier
 * valor y un código de cuatro dígitos es un espacio de 10.000: se prueba en un
 * segundo. Con la firma, cambiar un byte la invalida.
 */
function firmar(carga: string): string {
  return createHmac('sha256', FIRMA).update(carga).digest('base64url');
}

export function crearSesion(datos: Omit<SesionHub, 'desde'>): { valor: string; maxAge: number } {
  const sesion: SesionHub = { ...datos, desde: new Date().toISOString() };
  const carga = Buffer.from(JSON.stringify(sesion)).toString('base64url');
  return {
    valor: `${carga}.${firmar(carga)}`,
    maxAge: DIAS * 24 * 60 * 60,
  };
}

/**
 * Lee la cookie y la valida. Devuelve `null` si no hay, si está manipulada o si
 * lleva un formato que no se reconoce. No lanza: una cookie inválida es lo mismo que no
 * tener cookie, que es no haber entrado.
 */
export function leerSesion(valor: string | undefined | null): SesionHub | null {
  if (!valor) return null;
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const [carga, firma] = partes;

  // Comparación en tiempo constante: si comparamos con `===`, el tiempo que
  // tarda en responder dice cuántos caracteres correctos lleva la firma.
  const esperada = Buffer.from(firmar(carga));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return null;
  if (!timingSafeEqual(esperada, recibida)) return null;

  try {
    const sesion = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8')) as SesionHub;
    if (!sesion?.nombre || !sesion?.email || !sesion?.proyecto) return null;
    return sesion;
  } catch {
    return null;
  }
}

/**
 * El código de un cliente, comparado sin filtrar por tiempos.
 *
 * `timingSafeEqual` exige la misma longitud, y un código de cuatro dígitos
 * siempre la tiene, así que primero se comprueba la longitud y luego se
 * compara. El padding es solo por seguridad del helper, no hace falta.
 */
export function codigoCorrecto(esperado: string | null, recibido: string): boolean {
  if (!esperado) return false;
  const a = Buffer.from(esperado.padEnd(8, '\0').slice(0, 8));
  const b = Buffer.from(recibido.padEnd(8, '\0').slice(0, 8));
  return timingSafeEqual(a, b);
}

/** El nombre de la cookie, para el middleware y para borrarla al salir. */
export const NOMBRE_COOKIE = COOKIE;
