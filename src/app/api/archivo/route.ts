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
  // MEDIDO 2026-10-04. Acceso libre. Esta ruta solo COMPRUEBA si un objeto del
  // bucket existe, y exigir la cookie hacia que toda imagen de una ficha sin
  // sesión se renderizara rota. El filtro real es el `path`, que tiene que
  // empezar por el slug, y el bucket no es publico de escritura.
  //
  // Lo que NO se afloja: sigue siendo un `HEAD` sobre la URL pública, que es lo
  // que distingue «archivo borrado» de «archivo sano». Un 200 sin comprobar
  // sería devolver siempre «existe», y eso es un falso dato.

  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!path || path.length > 300) {
    return NextResponse.json({ error: 'Falta la ruta del archivo.' }, { status: 400 });
  }

  // MEDIDO 2026-10-04. Antes la ruta tenía que empezar por el cliente de la
  // cookie. Sin sesion ya no hay contra qué comparar, y el filtro que queda es el
  // catálogo: la primera carpeta de la ruta tiene que ser un cliente visible.
  //
  // Lo que NO cambia: `..` sigue prohibido y el bucket no se lista. Preguntar por
  // un archivo de un cliente oculto sigue dando 404, que es lo que se busca.
  const visibles = (process.env.HUB_CATALOGO_VISIBLE ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const clienteDeLaRuta = path.split('/')[0];
  // REGLA: si no hay catálogo configurado, se oculta TODO. No se puede
  // confundir "no configurado" con "visible": el default seguro es cerrado.
  if (visibles.length === 0 || !visibles.includes(clienteDeLaRuta)) {
    return NextResponse.json({ error: 'Ese archivo no existe.' }, { status: 404 });
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
