/**
 * El lado del navegador de la puerta: cuatro dígitos y un nombre.
 *
 * Todo va a `/api/entrar`, que es la única que sabe de códigos. Aquí no hay
 * ningún secreto: el código se teclea, se manda, el servidor lo comprueba y
 * devuelve el cliente y su gente. Lo que se guarda en la cookie lo firma el
 * servidor (`src/lib/hub-session.ts`), y aquí no se sabe nada de eso.
 *
 * Una llamada hace dos cosas según si se le pasa nombre o no:
 *
 * 1. Sin nombre: "¿qué abre este código?". Devuelve el cliente y la lista de
 *    quien tiene acceso. No entra nadie todavía.
 * 2. Con nombre: la persona elige y entra. El servidor comprueba el código Y que
 *    esa persona tenga fila de acceso en ese cliente, y pone la cookie firmada.
 */

/** Un cliente que tiene código. */
export type ClienteConCodigo = { slug: string; nombre: string };

export type PersonaHub = { nombre: string; correo: string };

/** Lo que devuelve la llamada: o hay cliente, o hay un motivo de por qué no. */
export type ResultadoPuerta =
  | { ok: true; cliente: ClienteConCodigo; personas: PersonaHub[] }
  | { ok: false; error: string };

async function pedir(datos: Record<string, unknown>) {
  const respuesta = await fetch('/api/entrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  return { ok: respuesta.ok, cuerpo: cuerpo as Record<string, unknown> };
}

/**
 * "¿Qué abre este código?" y, en la misma llamada, "¿quién entra?".
 *
 * Con `persona` se entra; sin ella solo se mira. Que devuelva ambas cosas es
 * intencionado: son el mismo concepto —el código del cliente— y partirlo en dos
 * rutas would've duplicado la comprobación del código en dos sitios, que es
 * justo como se desincroniza una regla.
 */
export async function entrarConCodigo(
  codigo: string,
  persona?: { correo: string; nombre: string }
): Promise<ResultadoPuerta> {
  const limpio = codigo.replace(/\D/g, '').slice(0, 4);
  if (limpio.length !== 4) {
    return { ok: false, error: 'Escribe los cuatro dígitos.' };
  }

  const { ok, cuerpo } = await pedir(
    persona
      ? { codigo: limpio, correo: persona.correo, nombre: persona.nombre }
      : { codigo: limpio }
  );

  if (!ok) {
    // El servidor nunca dice si el código existe: un "ese código no abre nada"
    // podría ser un código equivocado o un cliente sin gente. Aquí solo se
    // propaga lo que él dijo, sin añadir pistas.
    return { ok: false, error: String(cuerpo.error ?? 'No pudimos entrar.') };
  }

  return {
    ok: true,
    cliente: cuerpo.cliente as ClienteConCodigo,
    personas: (cuerpo.personas as PersonaHub[]) ?? [],
  };
}

/** Salir: la cookie se borra y la persona vuelve a la puerta. */
export async function salir() {
  await fetch('/api/entrar', { method: 'DELETE' });
}
