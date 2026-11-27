/**
 * Identidad por nombre, solo al crear una idea.
 *
 * El hub se recorre sin puerta. Cuando alguien sube una idea, dice quién es:
 * escribe un nombre nuevo o elige uno de los ya registrados. No hay código de
 * cliente ni registro con correo.
 *
 * Un nombre tecleado que coincide exactamente con uno registrado no se asume:
 * hay que elegirlo en la lista, para no tomar el acceso de otra persona por
 * error (o a propósito).
 */

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 80;

/** El rol de aplicación que ya existe y se usa si la persona está identificada pero no tiene fila en `rr_hub_access`. No crea policies ni grants. */
export const ROL_INVITADO = 'editor' as const;

/**
 * Normaliza un nombre escrito. Devuelve el texto listo o `null` si no sirve.
 */
export function nombreValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const nombre = valor.replace(/\s+/g, ' ').trim();
  if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) return null;
  return nombre;
}

/**
 * Compara nombres para el "¿ya está registrado?". Mayúsculas y espacios de más
 * no cuentan: "Ana  Pérez" y "ana pérez" son el mismo nombre.
 */
export function mismoNombre(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim().toLocaleLowerCase('es') ===
    b.replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
}

/**
 * Quién puede escribir en el proyecto, una vez hay perfil.
 *
 * Si hay fila de acceso, manda esa. Si no, el invitado identificado entra con
 * el rol `editor` que ya existe. Sin perfil (anónimo) no hay rol: eso es el
 * 403 que se veía al crear una idea sin decir quién eras.
 */
export function rolDeIdentidad(acceso: string | null | undefined): typeof ROL_INVITADO | string | null {
  if (acceso) return acceso;
  return ROL_INVITADO;
}
