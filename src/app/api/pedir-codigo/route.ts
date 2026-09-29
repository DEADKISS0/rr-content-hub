import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Pedir el código de acceso. Esta es la ÚNICA vía por la que la pantalla de
 * login manda un correo: el cliente del navegador no habla con GoTrue para esto.
 *
 * Por qué una ruta propia y no un `signInWithOtp` desde el navegador:
 *
 * 1. **Pedir el código no puede crear cuentas.** Con `shouldCreateUser: true`
 *    en el navegador, Supabase crea la cuenta de cualquier correo que se
 *    escriba, esté o no en el roster. Aquí se comprueba la lista blanca ANTES
 *    de pedir nada, así que una cuenta nueva solo nace de una cuenta que Dirección
 *    ya tenía anotada.
 *
 * 2. **La respuesta no dice si el correo existe.** Un `400` de "ese correo no
 *    está dado de alta" es un directorio abierto: se escriben direcciones y se
 *    ve cuáles se rebotan, y con eso se arma la lista de correos del equipo sin
 *    permiso. Aquí TODOS reciben `200` con el mismo texto. El que no está en la
 *    lista simplemente no recibe nada, y no puede saber si fue porque no está o
 *    porque hay un error.
 *
 * 3. **El código se pide desde el servidor**, con la clave del servidor, y el
 *    navegador nunca ve esa clave.
 */

/** La misma respuesta para todo el mundo. Cambiar esto sería abrir un directorio. */
const SIEMPRE_ENVIADO = { enviado: true } as const;
const SIEMPRE_MALO = { error: 'No pudimos mandarte el código. Escríbele a Dirección.' } as const;

export async function POST(request: Request) {
  let correo = '';
  try {
    const cuerpo = await request.json();
    correo = String(cuerpo?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json(SIEMPRE_MALO, { status: 400 });
  }

  if (!correo || !correo.includes('@')) {
    // Tampoco aquí se distingue "no parece un correo" de "no está en la lista".
    return NextResponse.json(SIEMPRE_ENVIADO, { status: 200 });
  }

  const supabase = await createClient();
  if (!supabase) {
    // Sin servidor de Supabase no hay ni lista blanca ni envío de código.
    console.error('[pedir-codigo] el servidor de Supabase no está configurado');
    return NextResponse.json(SIEMPRE_MALO, { status: 500 });
  }

  // La lista blanca, consultada por el mismo camino que usa el middleware para
  // dejar pasar: `is_team_member` Y `is_active`. Si alguien desactiva a una
  // persona, deja de recibir códigos en el mismo momento en que deja de entrar.
  const { data: enEquipo, error: errorRoster } = await supabase
    .from('rr_hub_quien_puede_entrar')
    .select('id')
    .eq('email', correo)
    .maybeSingle();

  if (errorRoster) {
    // Un fallo de la base NO puede convertirse en "ese correo no existe": sería
    // inventarse un motivo. Se devuelve el mismo texto de siempre.
    console.error('[pedir-codigo] no se pudo leer la lista del equipo:', errorRoster.message);
    return NextResponse.json(SIEMPRE_MALO, { status: 500 });
  }

  if (!enEquipo) {
    // Correo que no está en la lista. No se pide nada a GoTrue —así no se crea
    // la cuenta— y se contesta igual que a todo el mundo.
    return NextResponse.json(SIEMPRE_ENVIADO, { status: 200 });
  }

  // Ahora sí, y solo para quien es del equipo. `shouldCreateUser: true` aquí es
  // correcto: la cuenta tiene que poder NACER el primer vez que esta persona
  // entra, y solo puede nacer si Dirección ya la tenía anotada.
  const { error } = await supabase.auth.signInWithOtp({
    email: correo,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error(`[pedir-codigo] fallo enviando a ${correo}:`, error.message);
    return NextResponse.json(SIEMPRE_MALO, { status: 500 });
  }

  return NextResponse.json(SIEMPRE_ENVIADO, { status: 200 });
}