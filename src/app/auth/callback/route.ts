import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Aterrizaje de OAuth.
 *
 * Este handler es la única puerta por la que vuelve un inicio de sesión con
 * Google, y recibe dos cosas: el `code` de Supabase y, opcionalmente, un
 * `next` con la ruta a la que esta persona quería ir.
 *
 * Por qué el `next` viaja en la URL y no directo: el Content Hub y Medellín
 * Guide comparten proyecto de Supabase y cliente de OAuth de Google. Supabase
 * tiene UN solo destino de respaldo (su `SITE_URL`, que es el de la aplicación
 * que configuró el proyecto), así que cualquier login que llegue sin destino
 * —porque se perdió el estado, o porque la otra app pidió el suyo— aterriza en
 * la aplicación equivocada. De ahí el reporte: "entro al hub y me abre Medellín
 * Under".
 *
 * Por eso el login SIEMPRE manda aquí y nunca el destino final: `/auth/callback`
 * es la ruta que está en la lista de permitidos de GoTrue. Un destino final
 * libre sería rechazado y se caería igual al `SITE_URL` equivocado.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const pedido = searchParams.get('next') ?? '/select-project';

  // Solo rutas internas. `//evil.example` es un redirect abierto y
  // `https://otro` sacaría a la persona del sitio.
  const next = pedido.startsWith('/') && !pedido.startsWith('//') ? pedido : '/select-project';

  // Google (o Supabase) pueden devolver un error con descripción; volver al
  // login con el motivo es mejor que dejarlo en un 307 mudo.
  if (error) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error)}`);
  }

  if (code) {
    const supabase = await createClient();
    if (!supabase) return NextResponse.redirect(`${origin}/login?error=missing_supabase`);
    const { error: fallo } = await supabase.auth.exchangeCodeForSession(code);
    if (!fallo) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // might include port
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // no hay balanceador en medio, no hace falta mirar X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}&error=auth_callback_error`);
}
