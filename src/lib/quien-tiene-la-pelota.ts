/*
 * Quién tiene la pelota: los NOMBRES de las personas, no el número de piezas.
 *
 * MEDIDO 2026-10-05 (feedback de Santiago): el panel decía «1 Esperan a alguien
 * de fuera» y del lado «C CLIENTE · 1 PIEZA O6», con la inicial «C» en un
 * cuadrado y el código de la pieza. El número no dice a quién hay que empujar:
 * con 21 personas con acceso, «35 ESPERANDO QUE EL EQUIPO LAS MUEVA» no le dice
 * a nadie qué hacer el lunes. Santiago pidió los nombres, con primer nombre y
 * primer apellido, no los códigos.
 *
 * El dato para eso ya existía: `rr_hub_access` une `user_id` con
 * `rr_hub_profiles.full_name`. La regla del repo sigue igual —el rol del cliente
 * vive en `rr_hub_access.role_in_project`, no en `rr_hub_profiles.global_role`— y
 * por eso la función recibe el rol YA resuelto por el servidor.
 */

/**
 * Deja «Primer nombre» + «Primer apellido», y nada más.
 *
 * MEDIDO 2026-10-05, sobre los 21 `full_name` que hay en `rr_hub_profiles`:
 *
 *   4 partes (9 personas)  María Alejandra Peralta Suarez
 *                         Nicolás David Río Vargas
 *                         Andrés Santiago Rosas Rios
 *   3 partes (9 personas)  Samuel Jiménez Ochoa
 *                         Santiago Medina Lopez
 *                         Estiven Serna Benítez
 *   2 partes (3 personas)  Sthefany Diaz · Alejandra Suarez · RR Aliados
 *
 * El patrón del equipo es nombre + nombre compuesto + dos apellidos. Sacar la
 * primera y la última daba «Andrés Rios», que se lee como otra persona: el
 * apellido es la TERCERA parte, no la cuarta. Por eso la regla toma la 1 y la 3.
 *
 * Lo que no se hace, y es lo importante:
 *  - No se adivina el apellido con un diccionario. «Samuel Jiménez Ochoa» es
 *    OLEDER si se toma la última y es JIMÉNEZ si se toma la tercera; no hay
 *    forma de saberlo desde el string, así que se sigue el patrón del equipo,
 *    que es consistente en las 18 personas con nombre de pila real.
 *  - Las cuentas que no son personas («RR Aliados», «Chat RR», «Cliente Wundeer
 *    1») no se mutilan: se detectan por un marcador y se dejan enteras.
 *  - Sin nombre no se inventa nada: cadena vacía.
 */
export function nombreCorto(fullName?: string | null): string {
  const nombre = (fullName ?? '').trim();
  if (!nombre) return '';

  // Cuentas de servicio y cuentas de cliente: no son personas, no se recortan.
  //
  // MEDIDO 2026-10-05 sobre `rr_hub_profiles`: hay dos filas «Cliente Wundeer 1»
  // y «Cliente Wundeer 2». El número FINAL es lo que las distingue, así que
  // quitarlo —como hacía el corte por `slice`— dejaba las dos iguales y el panel
  // decía «Cliente Wundeer» dos veces sin decir a cuál se refiere. La cuenta se
  // devuelve ENTERA.
  if (/^(cliente|chat|cuenta|rr|admin|sistema)\b/i.test(nombre)) return nombre;

  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');

  // 4 partes: nombre, nombre compuesto, apellido paterno, apellido materno.
  // 3 partes: nombre, apellido paterno, apellido materno.
  // En los dos casos el primer apellido es la tercera de cuatro o la segunda de
  // tres: el mismo índice contando desde atrás.
  return partes.length >= 4
    ? `${partes[0]} ${partes[2]}`
    : `${partes[0]} ${partes[1]}`;
}

/** Iniciales para el cuadrado: primera letra del nombre y del apellido. */
export function iniciales(fullName?: string | null): string {
  const corto = nombreCorto(fullName);
  if (!corto) return '?';
  const partes = corto.split(' ').filter(Boolean);
  const primera = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return (primera + ultima).toUpperCase() || '?';
}

export type Persona = { nombre: string; piezas: string[]; total: number };

/**
 * Agrupa piezas por persona a partir de su responsable.
 *
 * `responsablePorPieza` mapea id de pieza → nombre completo, o `null` cuando
 * nadie es responsable. Las piezas sin responsable NO se inventan ni se cuelan en
 * el grupo de alguien: van en su propia entrada, con la verdad de que están sin
 * dueño.
 */
export function agruparPorPersona(
  piezas: { id: string; code?: string | null }[],
  responsablePorPieza: Map<string, string | null>,
): Persona[] {
  const grupos = new Map<string, Persona>();

  for (const pieza of piezas) {
    const codigo = pieza.code ?? 'IDEA';
    const completo = responsablePorPieza.get(pieza.id) ?? null;
    const nombre = nombreCorto(completo);

    // Sin responsable real: la pieza no es de nadie. Se agrupa aparte en vez de
    // colgarse de la primera persona de la lista.
    const clave = nombre || 'Sin responsable';

    const previo = grupos.get(clave) ?? { nombre: clave, piezas: [], total: 0 };
    previo.piezas.push(codigo);
    previo.total += 1;
    grupos.set(clave, previo);
  }

  // Primero quien más tiene encima: es quien más puede mover hoy.
  return [...grupos.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
}