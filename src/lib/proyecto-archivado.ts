/**
 * Un proyecto archivado sigue en la base. No se borra: se esconde.
 *
 * `archived_at` null es un cliente vivo. Con fecha, salió del catálogo, de la
 * puerta y de las rutas, y sus filas siguen donde estaban.
 */

export function estaArchivado(archivedAt: string | null | undefined): boolean {
  return archivedAt != null && archivedAt !== '';
}

/** La marca va en el nombre que ya pinta la interfaz, sin un componente nuevo. */
export function marcarNombreArchivado(name: string, archivedAt: string | null | undefined): string {
  if (!estaArchivado(archivedAt)) return name;
  if (name.toUpperCase().includes('ARCHIVADO')) return name;
  return `${name} · ARCHIVADO`;
}
