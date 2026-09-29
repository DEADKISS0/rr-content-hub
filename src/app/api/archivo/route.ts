import { NextResponse, type NextRequest } from 'next/server';
import { quienEs } from '@/lib/quien-es';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * ¿Está este archivo en el bucket?
 *
 * Antes lo comprobaba el navegador con `supabase.storage.list()` y la clave
 * anónima. Con la puerta por código esa clave no lee el bucket, así que la
 * comprobación devolvía "no está" para TODO y cada imagen ya subida se veía
 * rota, sin error en ningún sitio.
 *
 * `getPublicUrl` es lo contrario de una comprobación: construye una cadena
 * exista el objeto o no, y siempre devuelve algo. Sin esta pregunta, un archivo
 * borrado se renderiza como una imagen rota y uno sano como una imagen rota:
 * no hay forma de distinguirlos.
 *
 * Se comprueba por `HEAD` sobre la URL pública en vez de listar la carpeta:
 * listar trae el contenido de toda la carpeta de la etapa, que puede tener
 * videos de 100 MB, y para aprender si hay un archivo basta con preguntar por
 * ese archivo.
 */
export async function GET(request: NextRequest) {
  const sesion = await quienEs();
  if (!sesion) {
    return NextResponse.json({ error: 'Entra con el código de tu cliente.' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!path || path.length > 300) {
    return NextResponse.json({ error: 'Falta la ruta del archivo.' }, { status: 400 });
  }

  // La ruta tiene que empezar por el cliente de la cookie. Sin esto, con el
  // código de Wundeer se podía preguntar por cualquier archivo del bucket,
  // incluido el de otro cliente.
  if (!path.startsWith(`${sesion.proyecto}/`)) {
    return NextResponse.json({ error: 'Ese archivo no es de tu cliente.' }, { status: 403 });
  }
  // Y no puede salirse de la carpeta con `..`.
  if (path.includes('..')) {
    return NextResponse.json({ error: 'Ruta no válida.' }, { status: 400 });
  }

  const service = await createServiceClient();
  if (!service) {
    return NextResponse.json({ error: 'El servidor no tiene la configuración de Supabase.' }, { status: 500 });
  }

  // `list` con la búsqueda exacta del archivo: es una consulta de metadatos, no
  // baja los bytes. Devolver el nombre exacto es lo que decide; una búsqueda
  // parcial daría un falso positivo con `prueba.png` y `prueba.png.2`.
  const carpeta = path.slice(0, path.lastIndexOf('/') + 1);
  const archivo = path.slice(path.lastIndexOf('/') + 1);
  const { data, error } = await service.storage
    .from('rr-content-assets')
    .list(carpeta, { search: archivo });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const existe = (data ?? []).some((entrada) => entrada.name === archivo);

  return NextResponse.json({ existe, path });
}
