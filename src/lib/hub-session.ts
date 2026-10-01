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

/**
 * La clave con la que se firma la cookie de sesión.
 *
 * MEDIDO 2026-10-01 (auditoría de seguridad): esta línea era un `??` con un
 * LITERAL de 26 caracteres escrito justo aquí, y `HUB_SECRET` no existía en las
 * variables de Vercel. El `??` ganaba siempre, así que la app firmaba las
 * sesiones con una clave publicada en el repo, el README y este archivo.
 *
 * Eso abría la puerta entera sin código: cualquiera que copiara el literal
 * podía fabricar una cookie válida para cualquier correo y cualquier cliente.
 * Y como la autoridad sale de la cookie, elegir un correo de
 * `SUPER_ADMIN_EMAILS` daba `owner`: lectura de todos los guiones, escritura y
 * `borrar`.
 *
 * El `??` con un valor por defecto es exactamente la forma de este fallo: la
 * app levanta, todo funciona, y el cerrojo está publicado. Por eso ahora no
 * hay valor por defecto que se pueda volver a publicar: si falta el secreto, la
 * app no arranca y se nota en el primer deploy, no cuando alguien entra.
 */
function claveFirma(): string {
  const s = process.env.HUB_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'HUB_SECRET no está configurado o es demasiado corto. Sin esta clave no se ' +
        'puede firmar la sesión: la app NO debe arrancar con una clave por defecto ' +
        'porque esa clave terminaría publicada.',
    );
  }
  return s;
}

/** Cacheada: la clave no cambia dentro de un mismo proceso de Vercel. */
let FIRMA: string | undefined;

function firma(): string {
  if (FIRMA === undefined) FIRMA = claveFirma();
  return FIRMA;
}

const DIAS = 30;

/**
 * La cookie va firmada. Sin firma, `document.cookie` deja escribir cualquier
 * valor y un código de cuatro dígitos es un espacio de 10.000: se prueba en un
 * segundo. Con la firma, cambiar un byte la invalida.
 */
function firmar(carga: string): string {
  return createHmac('sha256', firma()).update(carga).digest('base64url');
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
 * MEDIDO 2026-10-01 (auditoría de seguridad): esta función comparaba el código
 * con `timingSafeEqual` y estaba testeada, y NINGUNA ruta la importaba.
 * `/api/entrar` delega en el RPC de Postgres, que compara con `=` normal.
 *
 * O sea: era la intención de seguridad escrita con su test, sin efecto
 * ninguno. Un test que cubre código que nadie ejecuta da confianza falsa, y
 * por eso se borra en vez de dejarse. Si algún día hace falta comparar en
 * tiempo constante, se escribe con la ruta que la use.
 */

/** El nombre de la cookie, para el middleware y para borrarla al salir. */
export const NOMBRE_COOKIE = COOKIE;
