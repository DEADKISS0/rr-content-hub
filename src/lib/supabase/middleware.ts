import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Public mode. Authentication is intentionally disabled: every route is open and
 * the whole hub is browsable without credentials. Session refresh still runs so
 * that turning `NEXT_PUBLIC_AUTH_ENABLED` back on restores the gate with no
 * other change.
 */
export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Keep the signed-in session fresh when someone does log in.
  await supabase.auth.getUser();

  // Gate de escritura. La página de creación se ABRE siempre: la persona ve
  // el formulario, pega su referencia y lee el brief. Exigir sesión en la puerta
  // devolvía un 307 a /login sin `next`, así que la persona aterrizaba en un
  // formulario vacío y concluía "no carga" — sin haber visto nunca el error.
  // La sesión se pide al GUARDAR, donde el aviso puede traer su propio botón
  // para entrar sin perder lo escrito. `/api/workspace` sí va aquí: una
  // mutación no puede depender de que el cliente se acuerde de preguntar.
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true') {
    const path = request.nextUrl.pathname;
    // `/api/pedir-codigo` es la puerta de ENTRADA: pedir el código es justamente
    // lo que se hace sin sesión todavía. Si cae en la rama de abajo devolvía 401
    // y el login se quedaba mudo, con un texto que no cuadraba con nada de lo que
    // la persona había hecho. Va antes que el filtro, con `/login` y `/auth/`.
    if (path.startsWith('/login') || path.startsWith('/auth/') || path === '/api/pedir-codigo') {
      return supabaseResponse;
    }
    const SOLO_SERVIDOR = ['/audit/admin', '/api/workspace'];
    const pideSesion = SOLO_SERVIDOR.some((p) => path.startsWith(p));
    if (pideSesion) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Una API no tiene dónde mandar a nadie: el 307 es para el navegador y
        // `fetch` no lo sigue. Que responda 401 con su mensaje — el cliente lo
        // traduce a un aviso con botón. El 307 a /api/... era un callejón: nadie
        // llegaba a /login y el navegador solo veía "failed to fetch".
        if (path.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Necesitas una sesión con acceso a este proyecto para hacer eso.' },
            { status: 401 },
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('next', path);
        return NextResponse.redirect(url);
      }
    }

    // Tener sesión NO es ser del equipo, y son dos cosas distintas.
    //
    // Cualquiera puede abrirse una cuenta en Supabase por su cuenta sin pasar
    // por la app. Si la puerta se cierra solo con "hay sesión", cualquiera que
    // registre un Gmail cualquiera entra al hub a ver y a escribir. La lista
    // blanca se comprueba contra la vista, que es lo que Dirección controla.
    //
    // Por eso esto va en el middleware y no solo en el guard de la API: el guard
    // protege las mutaciones, pero las páginas se sirven sin pasar por él.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const correo = (user.email ?? '').toLowerCase();
      // La vista `rr_hub_quien_puede_entrar` es la lista blanca en una sola
      // pieza: exige `is_team_member` Y `is_active`. Antes esta consulta solo
      // miraba `is_active`, así que bastaba con registrarse para tener fila y
      // entrar: la lista blanca no estaba en la puerta, solo en la intención.
      const { data: enEquipo } = await supabase
        .from('rr_hub_quien_puede_entrar')
        .select('email')
        .eq('email', correo)
        .maybeSingle();
      if (!enEquipo) {
        // Sesión válida de alguien que no es del equipo. Se cierra la sesión
        // para que no pueda reentrar saltándose esto, y se le manda al login con
        // un motivo: "no estás en la lista" es distinto de "no has entrado".
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('sinAcceso', '1');
        url.searchParams.set('next', path);
        return NextResponse.redirect(url);
      }
    } else {
      // Una API no tiene a dónde mandar a nadie: un 307 es para el navegador y
      // `fetch` no lo sigue, así que el cliente solo lee "failed to fetch". Es lo
      // que pasaba con `/api/ideas`: el middleware lo capturaba en esta rama
      // genérica y le devolvía una redirección a una página, no un error de API.
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Necesitas una sesión con acceso a este proyecto para hacer eso.' },
          { status: 401 },
        );
      }
      // Sin sesión, y ya en el login o en la portada: se deja pasar.
      if (path === '/login' || path === '/') return supabaseResponse;
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
