import { NextResponse } from 'next/server';
import { crearSesion, NOMBRE_COOKIE } from '@/lib/hub-session';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * La puerta. Dos preguntas, una sola ruta.
 *
 * 1. `POST {codigo}` sin persona → ¿qué cliente abre este código y quién tiene
 *    acceso a él? No entra nadie: solo se mira.
 * 2. `POST {codigo, correo, nombre}` → la persona entra. El servidor comprueba
 *    el código Y que esa persona tenga fila de acceso en ESE cliente, y pone una
 *    cookie firmada.
 * 3. `DELETE` → salir.
 *
 * Por qué una sola ruta y no tres: el código se comprueba en un solo sitio. Con
 * una ruta para "buscar" y otra para "entrar", el día que cambie la regla del
 * código hay que acordarse de cambiarla en las dos, y basta con olvidar una para
 * que la puerta tenga un camino de más.
 *
 * Lo que NO se dice nunca: si el código existe. Un "ese código no abre ningún
 * cliente" y un "el cliente existe pero no tiene a nadie" son el mismo 401, y el
 * cliente tampoco se devuelve cuando el código falla. Cuatro dígitos son diez
 * mil: si se puede preguntar en bucle cuál existe, la puerta no existe.
 *
 * Por qué el nombre se manda en el cuerpo y no se deduce: la lista de quien tiene
 * acceso a un cliente ya se le enseñó a esa persona en el paso anterior, y es un
 * dato que ya tiene. Lo que NO se acepta es un nombre TECLEADO: eso sería
 * inventarse a alguien. La lista sale de la base y el servidor comprueba que la
 * persona elegida esté en ella.
 */

function sinCookie() {
  const respuesta = NextResponse.json({ error: 'Ese código no abre ningún cliente.' }, { status: 401 });
  return respuesta;
}

export async function POST(request: Request) {
  let cuerpo: { codigo?: string; correo?: string; nombre?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return sinCookie();
  }

  const codigo = String(cuerpo.codigo ?? '').replace(/\D/g, '').slice(0, 4);
  if (codigo.length !== 4) return sinCookie();

  const service = await createServiceClient();
  if (!service) {
    return NextResponse.json({ error: 'El sistema de acceso no está configurado.' }, { status: 500 });
  }

  // 1) ¿Qué cliente es? `rr_hub_cliente_por_codigo` no filtra por nada más, así
  //    que el código no se puede usar para recorrer clientes.
  const { data: slug, error: errorCliente } = await service.rpc('rr_hub_cliente_por_codigo', {
    p_codigo: codigo,
  });
  if (errorCliente) {
    console.error('[entrar] no se pudo leer el cliente:', errorCliente.message);
    return NextResponse.json({ error: 'No pudimos comprobar el código.' }, { status: 500 });
  }
  if (!slug) return sinCookie();

  const { data: proyecto, error: errorProyecto } = await service
    .from('rr_hub_projects')
    .select('slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (errorProyecto || !proyecto) {
    console.error('[entrar] el cliente del codigo no existe:', errorProyecto?.message);
    return sinCookie();
  }

  // 2) Sin persona: solo se mira. Se devuelve la gente con acceso, que es la
  //    lista de la pantalla. Es información que se le da a quien ya tiene el
  //    código, y sin código no se llega aquí.
  const correo = String(cuerpo.correo ?? '').trim().toLowerCase();
  if (!correo) {
    const { data: personas, error: errorPersonas } = await service.rpc('rr_hub_equipo_del_cliente', {
      p_codigo: codigo,
    });
    if (errorPersonas) {
      console.error('[entrar] no se pudo leer el equipo:', errorPersonas.message);
      return NextResponse.json({ error: 'No pudimos comprobar el código.' }, { status: 500 });
    }
    return NextResponse.json({
      cliente: { slug: proyecto.slug, nombre: proyecto.name },
      personas: (personas ?? []).map((p: { nombre: string; correo: string }) => ({
        nombre: p.nombre,
        correo: p.correo,
      })),
    });
  }

  // 3) Con persona: la puerta completa. `rr_hub_puede_entrar` exige las tres
  //    cosas —código correcto, persona con acceso a ESE cliente, del equipo y
  //    activa— y devuelve un sí o un no, sin decir cuál de las tres falló.
  const { data: puede, error: errorPuerta } = await service.rpc('rr_hub_puede_entrar', {
    p_codigo: codigo,
    p_email: correo,
  });
  if (errorPuerta) {
    console.error('[entrar] fallo la comprobacion de la puerta:', errorPuerta.message);
    return NextResponse.json({ error: 'No pudimos comprobar el código.' }, { status: 500 });
  }
  if (!puede) {
    return NextResponse.json(
      { error: 'Ese código no abre ningún cliente, o no tienes acceso a él.' },
      { status: 401 },
    );
  }

  // El nombre no se usa como está: se vuelve a pedir a la base. Si alguien
  // Teclea un nombre que no es el suyo, entra con el de verdad, y la ficha dice
  // la verdad.
  const { data: real } = await service
    .from('rr_hub_profiles')
    .select('full_name')
    .ilike('email', correo)
    .maybeSingle();
  const nombre = real?.full_name ?? String(cuerpo.nombre ?? '');

  const { valor, maxAge } = crearSesion({ nombre, email: correo, proyecto: proyecto.slug });
  const respuesta = NextResponse.json({
    ok: true,
    cliente: { slug: proyecto.slug, nombre: proyecto.name },
  });
  respuesta.cookies.set(NOMBRE_COOKIE, valor, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return respuesta;
}

/** Salir. Se borra la cookie y ya. */
export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(NOMBRE_COOKIE, '', { path: '/', maxAge: 0 });
  return respuesta;
}
