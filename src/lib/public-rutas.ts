/**
 * Que rutas del hub se sirven SIN sesion.
 *
 * DESDE 2026-10-02: TODAS.
 *
 * Santiago decidio abrir el Content Hub con la misma decision que el Centro de
 * Comandos del mega-dashboard: sin codigo de cuatro cifras, sin pedir correo, sin
 * sesion que comprobar. Los cuatro clientes (BOGA, Candilejas, Satiro Sushi y
 * Wundeer) quedan accesibles a cualquiera que llegue a la URL.
 *
 * LO QUE SE BORRA Y POR QUE
 *
 * Este archivo tenia una lista de rutas publicas y un monton de comentarios que
 * explicaban por que `/login` tenia que estar en ella: la PWA se instala antes
 * de tener sesion, y si el manifest exigiera cookie, el navegador recibiria HTML
 * donde esperaba JSON y el boton de instalar no aparecia en Android ni en iPhone.
 * Ese problema era real y estaba bien resuelto.
 *
 * Con la puerta abierta ya no tiene sentido: TODAS las rutas son publicas, asi
 * que no hay lista que mantener y no hay nada que pueda volver a caerse. Una
 * lista de "excepciones" que ya no tiene excepciones es una lista que el proximo
 * va a intentar volver a usar.
 *
 * SE CONSERVA LA FUNCION, y no por cortesia. Dos razones:
 *
 *  1. Hay tests que la EJECUTAN. Un archivo que decide a quien se le sirve cada
 *     ruta tiene que poder probarse, no solo leerse. Borrarla dejaria
 *     `public-rutas.test.ts` importando algo que no existe.
 *  2. Sirve como el unico sitio donde se responde "que es publico". El dia que
 *     aparezca una excepcion de verdad (un endpoint que tenga que seguir cerrado,
 *     como el guard de escritura del mega-dashboard), se escribe AQUI y en ningun
 *     otro sitio. Una regla de acceso repartida en tres archivos es una regla
 *     que se contradice en cuanto uno de los tres se queda viejo.
 *
 * `false` queda como respuesta por defecto para que la funcion siga siendo una
 * DECISION y no un `return true` disfrazado: si alguien la llama esperando que
 * filtre, ve que no filtra, en vez de obtener `true` y no enterarse de nada.
 */

/**
 * Rutas que siguen SIN ser publicas.
 *
 * Vacio a proposito. No se relleno con `/login` (ya no hay puerta que mostrar) ni
 * con los endpoints que habian quedado Publicos de serie.
 *
 * Cuando haga falta, la condicion va con una razon al lado. Por ejemplo, si el
 * panel de administracion tuviera que seguir cerrado, seria algo asi:
 *
 *   const CERRADAS = [
 *     // El panel escribe en rr_hub_assets: acceso abierto no puede significar
 *     // acceso para escribir. La razon va aqui, no en el codigo de quien llama.
 *     '/api/admin',
 *   ];
 */
const CERRADAS: { prefijo: string; razon: string }[] = [];

/** ¿Esta ruta se sirve sin sesion? */
export function esPublica(path: string): boolean {
  return !CERRADAS.some((c) => path === c.prefijo || path.startsWith(`${c.prefijo}/`));
}