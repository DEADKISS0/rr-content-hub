import { NextResponse, type NextRequest } from 'next/server';
import { quienEs } from '@/lib/quien-es';
import { createServiceClient } from '@/lib/supabase/service';
import { getComentarios, getAssets, getTimeline } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * Los datos vivos de una pieza: comentarios, archivos e historial.
 *
 * Antes los leía el navegador con la clave anónima. Con la puerta por código el
 * anon no tiene permiso de lectura sobre esas tablas, así que llegaban vacíos:
 * la ficha se veía como una pieza sin comentarios ni historial, y sin un solo
 * error, porque una lista que no se cargó y una lista vacía se ven iguales.
 *
 * Aquí se leen con la clave del servidor, y solo si quien pregunta entró. No
 * hace falta comprobar rol: leer la ficha no es escribirla, y el tablero ya
 * comprobó que el cliente de la cookie tiene ese proyecto.
 */
export async function GET(request: NextRequest) {
  const sesion = await quienEs();
  if (!sesion) {
    return NextResponse.json({ error: 'Entra con el código de tu cliente.' }, { status: 401 });
  }

  const ideaId = request.nextUrl.searchParams.get('ideaId') ?? '';
  if (!ideaId) return NextResponse.json({ error: 'Falta la idea.' }, { status: 400 });

  // La idea tiene que ser del cliente de la cookie. Sin esto, entrar con 1111 y
  // pedir el id de una idea de Candilejas devolvería sus comentarios.
  const service = await createServiceClient();
  if (!service) {
    return NextResponse.json({ error: 'El servidor no tiene la configuración de Supabase.' }, { status: 500 });
  }
  const { data: idea } = await service
    .from('rr_hub_ideas')
    .select('projects:rr_hub_projects(slug)')
    .eq('id', ideaId)
    .maybeSingle();
  const slug = (idea as { projects?: { slug?: string } | { slug?: string }[] } | null)?.projects;
  const proyectoSlug = Array.isArray(slug) ? slug[0]?.slug : slug?.slug;
  if (!proyectoSlug || proyectoSlug !== sesion.proyecto) {
    return NextResponse.json({ error: 'Esa pieza no es de tu cliente.' }, { status: 404 });
  }

  const [comentarios, assets, timeline] = await Promise.all([
    getComentarios(ideaId), getAssets(ideaId), getTimeline(ideaId),
  ]);

  return NextResponse.json({ comentarios, assets, timeline });
}
