/**
 * El `id` de quien entró, para el cliente del navegador.
 *
 * Existe por un caso concreto: la subida de archivos, donde el id va dentro de
 * la RUTA del objeto para que el servidor ate el archivo a quien lo subió. Con
 * la puerta por código no hay `auth.uid()`, así que el id se pide a la base por
 * correo, que es como la base relaciona a la gente.
 *
 * Va por HTTP y no importando el módulo de servidor a propósito: `quien-es.ts`
 * usa `next/headers`, que solo existe en Server Components, y `workspace-client`
 * es un módulo `'use client'`. Importarlo ahí rompe el BUILD entero — no es un
 * aviso, es un error de compilación.
 */
export async function idDeQuienEntra(): Promise<string | null> {
  const respuesta = await fetch('/api/quien-soy', { cache: 'no-store' });
  if (!respuesta.ok) return null;
  const cuerpo = (await respuesta.json().catch(() => null)) as { id?: string } | null;
  return cuerpo?.id ?? null;
}
