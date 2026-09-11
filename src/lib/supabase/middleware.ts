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

  // Authentication gate: OFF while public mode is active.
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;
    const isPublic = path.startsWith('/audit') || path.startsWith('/login') || path.startsWith('/auth');
    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
