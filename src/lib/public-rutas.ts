/**
 * Que rutas del hub se sirven SIN sesion.
 *
 * ESTO ES LO QUE HACE EXISTIR LA PWA (medido en produccion el 2026-09-30, dos
 * veces seguidas). La PWA se instala ANTES de tener sesion: el navegador pide el
 * manifest y los iconos para poder mostrar el boton de instalar. Si esas rutas
 * exigieran cookie, el proxy las mandaria a `/login`, el navegador recibiria
 * HTML donde esperaba un JSON, y no apareceria ningun boton de instalar ni en
 * Android ni en iPhone. Sin un solo error visible: sencillamente no hay app.
 *
 * POR QUE ESTA EN SU PROPIO ARCHIVO Y NO EN EL PROXY. Dos veces se ha tried
 * fixarlo aqui y las dos veces el arreglo se quedaba en el proxy sin que nada lo
 * comprobara. Ademas, una regla de "quien puede ver que" que se decide mirando
 * cadenas de texto es una regla que no se puede probar de verdad. Aqui la
 * funcion se exporta y los tests la EJECUTAN: si alguien mueve el prefijo de
 * sitio, el test lo dice. Un test que mira texto no ve un bug de comparacion.
 */

/** Rutas exactas publicas, ademas de lo que este en `/`. */
const PUBLICAS = ['/login', '/api/entrar', '/offline', '/manifest.webmanifest', '/sw.js'];

/**
 * Prefijos de ficheros estaticos que tambien son publicos: los iconos de la
 * PWA. Van APARTE y a proposito.
 *
 * La comparacion de `PUBLICAS` es `path === p || path.startsWith(`${p}/`)`. Si
 * un prefijo de ruta acabara en barra y se metiera en esa lista, la comparacion
 * buscaria `/app//`, con doble barra, y no coincidiria con NADA. Pasó: los doce
 * iconos devolvian 307 y el navegador recibia HTML. Por eso los prefijos que ya
 * terminan en `/` se comparan con `startsWith` a secas.
 *
 * Y NO se pone `'/'` aqui: abriria el hub entero sin sesion.
 */
const PREFIJOS_PUBLICOS = ['/app/'];

/** ¿Esta ruta se sirve sin sesion? */
export function esPublica(path: string): boolean {
  if (PREFIJOS_PUBLICOS.some((p) => path.startsWith(p))) return true;
  return PUBLICAS.some((p) => path === p || path.startsWith(`${p}/`));
}
