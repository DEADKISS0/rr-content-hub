import { NextResponse, type NextRequest } from 'next/server';
import { esPublica } from '@/lib/public-rutas';

/**
 * La puerta del hub, ahora SIN puerta (2026-10-02).
 *
 * QUE DECIDIO SANTIAGO
 *
 * Con la misma decisión que el Centro de Comandos del mega-dashboard: acceso
 * libre, sin código de cuatro cifras, sin pedir correo, sin sesión que comprobar.
 * Los cuatro clientes (BOGA, Candilejas, Satiro Sushi y Wundeer) quedan
 * accesibles a cualquiera que llegue a la URL.
 *
 * QUE SE BORRA Y POR QUE
 *
 * Este archivo antes era el corazón de la puerta. Leía la cookie firmada, y si no
 * había, mandaba a `/login` con un `next`. Las APIs respondían 401 con el texto
 * "Entra con el código de tu cliente". Todo eso se fue entero.
 *
 * Y hay una razón de fondo para quitarlo, que no es solo que el código fuera
 * incómodo: **cuatro dígitos son diez mil, y se prueban en un segundo.** El
 * rate-limit que hay en `app/api/entrar/route.ts` (añadido en la auditoría del
 * 2026-10-01) limita por IP, y eso no vuelve la puerta segura: una puerta de
 * diez mil combinaciones con un límite de intentos por IP es un formulario
 * delante de la puerta, no una puerta.
 *
 * LO QUE NO SE BORRA, Y POR QUE
 *
 * La sesión firmada (`hub_sesion`) y `leerSesion` siguen existiendo. La cookie la
 * siguen escribiendo `api/entrar` y `api/workspace`, y el guard de cada mutación
 * sigue comprobando `rr_hub_access`, que es lo que decide QUÉ PUEDE HACER una
 * persona, no si entra. Borrar la sesión habría sido tirar la trazabilidad de
 * qué registro cambió qué en el hub, que es lo único que permite después saber
 * quién tocó qué.
 *
 * Es la misma distinción que en el mega-dashboard: **abrir la puerta no es abrir
 * la escritura.** Quien llega sin cookie entra como visitante sin nombre, y las
 * escrituras siguen pasando por el guard.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // La decisión vive en `public-rutas.ts` y en ningún otro sitio. Hoy esa lista
  // está vacía, así que esto siempre pasa; el `if` se queda explícito para que el
  // día que haya una ruta cerrada se vea aquí el sitio donde se decidió, en vez
  // de tener que reconstruir por qué esta línea existe.
  if (esPublica(path)) {
    return NextResponse.next({ request });
  }

  // Hoy no se llega aquí. Esta rama queda para que añadir una excepción sea
  // escribir UNA línea en `public-rutas.ts`, y no rearmar el rebote a `/login`.
  // No se llega aquí hoy (CERRADAS está vacío). Si algún día se añade una ruta
  // cerrada, va a la portada y no a `/login`: esa pantalla ya no existe, y mandar
  // allí sería un 404 en lugar de una respuesta.
  return NextResponse.next({ request });
}