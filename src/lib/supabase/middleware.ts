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

  // Authentication gate: solo rutas de escritura y admin requieren sesion.
  // Todo lo demas (tablero, fichas, auditoria de lectura) sigue publico.
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true') {
    const path = request.nextUrl.pathname;
    const PROTECTED = ['/audit/admin', '/api/workspace', '/wundeer/ideas/nueva'];
    const isProtected = PROTECTED.some((p) => path.startsWith(p));
    if (isProtected) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
