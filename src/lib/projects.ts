/**
 * Los clientes que el hub enseña.
 *
 * La lista se fue de "solo Wundeer" a "el cliente del código con el que entraste".
 *
 * Antes esto era una lista fija (`['wundeer']`) que filtraba la navegación, la
 * raíz, el índice de auditoría y el cargador de proyecto. Con Candilejas eso
 * dejaba una fila sin puerta: el proyecto existía en la base, con sus ideas y
 * su color, y no aparecía en ningún lado. `/candilejas` devolvía 404 y no había
 * forma de llegar a él.
 *
 * Ahora la pregunta no es "qué proyectos hay" sino "a cuál me dejó entrar el
 * código". El código es lo que se teclea en `/login`, así que lo visible es
 * exactamente lo que se tecleó: no hay un menú donde se vea un cliente al que no
 * se tiene el código.
 *
 * La lista de clientes conocidos sigue existiendo, y sigue haciendo falta: un
 * slug tiene que ser uno de ellos para que un `?projectSlug=` inventado no abra
 * nada. Lo que ya no hace es decidir a quién se le muestran las cosas — de eso
 * se encarga la cookie firmada (`hub-session.ts`).
 */

/** Clientes que el hub conoce. Es la lista corta, no la de autorización. */
export const CLIENTES_CONOCIDOS = ['wundeer', 'candilejas'] as const;

export function isVisibleProject(slug?: string | null): boolean {
  if (!slug) return false;
  return (CLIENTES_CONOCIDOS as readonly string[]).includes(slug);
}

/**
 * ¿Este cliente se ve desde la sesión que hay abierta?
 *
 * La respuesta sale de la cookie, nunca de la URL. `/candilejas` con una cookie
 * de Wundeer da 404 a propósito: no es un descuido de rutas, es que el código de
 * Candilejas es otro — y esa es la forma de decirlo sin explicarlo.
 */
export function clienteEsVisible(slug: string, proyectoDeLaSesion: string | null | undefined): boolean {
  if (!proyectoDeLaSesion) return false;
  return proyectoDeLaSesion === slug;
}
