/**
 * Qué perfil está emitiendo el voto desde este navegador.
 *
 * MEDIDO 2026-10-03. Lo que había: en el tablero, quien entraba sin puerta
 * veía un cartel que decía SOLO LECTURA y no podía votar. La votación interna
 * es justamente lo que el equipo hace sin ser cliente, así que dejarla detrás
 * de un cartel la dejaba sin usar.
 *
 * Lo que se hace, y por qué:
 *
 * - El perfil se ELIGE, no se deduce. La identidad del voto sigue siendo la del
 *   servidor (`email` de la sesión o el perfil elegido, ambos contra la lista
 *   del equipo). Esto no abre nada: solo cambia QUIÉN vota, no si puede votar.
 *
 * - El token del navegador sigue siendo la clave del upsert. Es lo que impide
 *   que un mismo navegador emita dos votos para dos personas distintas y
 *   controle la votación desde una sola máquina. Elegir perfil cambia el nombre
 *   que va en `voter_email`; la fila del vote sigue siendo
 *   `UNIQUE (idea_id, voter_token)`.
 *
 * - El perfil elegido se guarda en `localStorage` y se manda en cada vote. No se
 *   manda solo el email: el servidor lo vuelve a comprobar contra
 *   `rr_hub_profiles.is_team_member` e `is_active`, así que escribir un correo
 *   cualquiera en esta lista no vota en nombre de nadie.
 *
 * Por qué no se guarda en la cookie de sesión: la cookie identifica a quien
 * ENTRA. El perfil de voto identifica a quien vota dentro de la votación, y son
 * cosas distintas — se entra una vez, se vota como el que toque en cada idea.
 */
import type { DecisionVoto } from './flow';

const LLAVE_PERFIL = 'rr_perfil_votante';

/** Una persona del equipo que puede votar. */
export type PerfilVotante = {
  email: string;
  nombre: string;
};

/** Lo que devuelve el servidor: el perfil guardado y el equipo completo. */
export type EstadoPerfiles = {
  /** El perfil elegido en ESTE navegador, o null si todavía no se eligió. */
  elegido: PerfilVotante | null;
  /** Las personas que pueden votar. Nunca vacío si el servidor respondió bien. */
  equipo: PerfilVotante[];
};

/**
 * El perfil elegido, o null.
 *
 * Se lee en cada render porque dos personas pueden estar en el mismo navegador
 * —y es justo el caso que este selector existe para—. Es `localStorage`, que es
 * síncrono y no necesita estado.
 */
export function perfilElegido(): PerfilVotante | null {
  if (typeof window === 'undefined') return null;
  try {
    const crudo = window.localStorage.getItem(LLAVE_PERFIL);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as PerfilVotante;
    if (!dato?.email) return null;
    return { email: dato.email, nombre: dato.nombre ?? dato.email };
  } catch {
    // Un `localStorage` corrupto (a mano, o de una versión anterior del esquema)
    // no puede dejar la pantalla sin pintar. Se trata como "no elegido".
    return null;
  }
}

/** Guarda el perfil elegido. Un null lo borra: es "vuelvo a no haber elegido". */
export function guardarPerfil(perfil: PerfilVotante | null): void {
  if (typeof window === 'undefined') return;
  if (!perfil) {
    window.localStorage.removeItem(LLAVE_PERFIL);
    avisarCambioPerfil();
    return;
  }
  window.localStorage.setItem(LLAVE_PERFIL, JSON.stringify(perfil));
  // El `storage` del navegador no salta en ESTA pestaña. Sin esto, elegir un
  // perfil no repinta el botón que acabas de pulsar: se guardaba bien y se veía
  // como si nada. MEDIDO 2026-10-03 en producción.
  avisarCambioPerfil();
}

/** El email del perfil elegido, o cadena vacía si no hay ninguno. */
export function emailElegido(): string {
  return perfilElegido()?.email ?? '';
}

/**
 * Si el email es de una persona del equipo.
 *
 * No es una autorización: es solo para pintar el botón de "votar" sin esperar al
 * servidor. La comprobación de verdad la hace el servidor en cada voto, y si ahí
 * el correo no está en la lista, responde 403 y el voto no se guarda.
 */
export function esDelEquipo(email: string, equipo: PerfilVotante[]): boolean {
  if (!email) return false;
  const limpio = email.trim().toLowerCase();
  return equipo.some((p) => p.email.trim().toLowerCase() === limpio);
}

/**
 * Avisar cuando el perfil elegido cambia.
 *
 * MEDIDO 2026-10-03. Esto solo escuchaba el evento `storage`, y el navegador NO lo
 * dispara en la pestaña que escribe: solo en las OTRAS. El bug era visible en la
 * propia pestaña —elegir un perfil y el botón seguía diciendo «ELEGIR QUIÉN VOTA»—
 * y «no deja cambiar el perfil» era justo eso.
 *
 * `useSyncExternalStore` re-lee `getSnapshot` cuando la suscripción avisa, así que
 * no vale con que alguien escriba: hay que avisar, y en las DOS vías:
 *
 * - `rr_perfil_votante_cambio`, un evento propio que dispara `guardarPerfil`. Es lo
 *   que arregla la propia pestaña.
 * - `storage`, que el navegador dispara en las demás pestañas de la misma persona.
 *
 * Con las dos, cambiar el perfil se ve al instante en la reunión, que es donde se
 * hace: dos pestañas del mismo equipo son lo normal, no la excepción.
 */
const EVENTO_PERFIL = 'rr_perfil_votante_cambio';

export function avisarCambioPerfil(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO_PERFIL));
}

export function suscribirPerfil(alCambiar: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', alCambiar);
  window.addEventListener(EVENTO_PERFIL, alCambiar);
  return () => {
    window.removeEventListener('storage', alCambiar);
    window.removeEventListener(EVENTO_PERFIL, alCambiar);
  };
}
