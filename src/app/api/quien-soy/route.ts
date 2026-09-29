import { NextResponse } from 'next/server';
import { quienEs } from '@/lib/quien-es';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * "¿Quién soy?" Lo pregunta la barra lateral para saber a quién pertenece la
 * sesión que hay abierta.
 *
 * Antes salía de `supabase.auth.getUser()` en el navegador. Ahora sale de la
 * cookie firmada del hub (`src/lib/hub-session.ts`), y la respuesta es la misma:
 * el correo de la persona. Sin cookie devuelve 401, no un `null` con 200: el
 * cliente usa el 401 para pintar el botón de entrar.
 *
 * No devuelve el rol ni el cliente. La barra lateral no los necesita, y
 * devolverlos sería darle a cualquier página una respuesta con la que decidir
 * cosas que en realidad decide `rr_hub_access`.
 */
export async function GET() {
  const sesion = await quienEs();
  if (!sesion) {
    return NextResponse.json({ error: 'No has entrado.' }, { status: 401 });
  }
  // El `id` se resuelve aquí, en el servidor, porque `rr_hub_profiles` no se
  // puede leer desde el navegador con su RLS. Va en la respuesta solo porque la
  // subida de archivos lo necesita para la ruta del objeto: es un identificador
  // interno del hub, no una cuenta de Supabase.
  const service = await createServiceClient();
  let id: string | null = null;
  if (service) {
    const { data: perfil } = await service
      .from('rr_hub_profiles')
      .select('id')
      .ilike('email', sesion.email)
      .maybeSingle();
    id = perfil?.id ?? null;
  }

  return NextResponse.json({
    email: sesion.email,
    nombre: sesion.nombre,
    proyecto: sesion.proyecto,
    id,
  });
}
