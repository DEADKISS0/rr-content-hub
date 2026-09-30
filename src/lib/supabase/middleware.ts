import { NextResponse, type NextRequest } from 'next/server';
import { leerSesion, NOMBRE_COOKIE } from '@/lib/hub-session';
import { esPublica } from '@/lib/public-rutas';

/**
 * La puerta del hub, ahora con códigos y no con correos (2026-09-28).
 *
 * Lo que hace este archivo es mucho más pequeño que antes, y esa es la mejora:
 * ya no hay que hablar con Supabase Auth en cada petición. Antes cada request
 * llamaba a `supabase.auth.getUser()` dos o tres veces —una para refrescar la
 * sesión, otra para la lista blanca, otra para la comprobación— y eso era
 * lentísimo y frágil. Ahora es leer una cookie firmada y ya.
 *
 * Lo que sigue igual, y es lo importante:
 *
 * - **Tener cookie NO es tener acceso.** La cookie dice quién eres y a qué
 *   cliente entraste. Lo que puedes hacer lo decide `rr_hub_access`, y eso se
 *   comprueba en el guard de cada mutación, no aquí. La cookie no da permisos.
 *
 * - **La cookie está firmada.** Sin firma, `document.cookie` deja escribir
 *   cualquier valor, y un código de cuatro dígitos es un espacio de 10.000: se
 *   prueba en un segundo. Con la firma, cambiar un byte la invalida.
 *
 * - **Una persona puede estar en varios clientes.** La cookie guarda con qué
 *   cliente se entró, y las páginas se sirven por slug. Cambiar de cliente es
 *   volver a entrar con el otro código, que es lo natural: son dos puertas
 *   distintas.
 */

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sesion = leerSesion(request.cookies.get(NOMBRE_COOKIE)?.value);

  // La puerta y la API de la puerta: siempre se sirven. `/api/entrar` va aquí
  // porque ES la puerta, y si cayera en la rama de "sin sesión" devolvería 401
  // a la única llamada que puede crear la sesión.
  if (esPublica(path)) {
    return NextResponse.next({ request });
  }

  if (sesion) {
    return NextResponse.next({ request });
  }

  // Sin cookie. Una API no tiene a dónde mandar a nadie: un 307 es para el
  // navegador y `fetch` no lo sigue, así que el cliente solo lee "failed to
  // fetch". Que responda 401 con su mensaje.
  if (path.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Entra con el código de tu cliente para poder hacer eso.' },
      { status: 401 },
    );
  }

  // La portada se puede ver sin entrar: es donde se elige cliente. Todo lo
  // demás, a la puerta, guardando a dónde iba.
  if (path === '/') {
    return NextResponse.next({ request });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('next', path);
  return NextResponse.redirect(url);
}
