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
  }

  return supabaseResponse;
}
