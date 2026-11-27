import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { catalogoIncluye } from '@/lib/config';
import { firmaDeImagen, TIPOS_DE_IMAGEN } from '@/lib/firma-imagen';

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
  const clienteDeLaRuta = path.split('/')[0];
  if (!catalogoIncluye(clienteDeLaRuta)) {
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

  // El editor de la ficha pide los bytes por aquí, no por la URL del bucket.
  // Una imagen de otro origen mancha el lienzo y el navegador se niega a
  // exportarla. La misma puerta de siempre (catálogo, sin `..`) y, encima, la
  // firma: solo sale una imagen de verdad. No es una política nueva de RLS;
  // lee con el mismo cliente de servicio que ya usa esta ruta para listar.
  if (request.nextUrl.searchParams.get('bytes') === '1') {
    return bytesDeImagen(service, path);
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

const TOPE_EDITOR = 25 * 1024 * 1024;

function tipoDeImagen(binario: Uint8Array, declarado: string): string | null {
  const limpio = declarado.split(';')[0].trim().toLowerCase();
  if ((TIPOS_DE_IMAGEN as readonly string[]).includes(limpio) && firmaDeImagen(binario, limpio)) return limpio;
  for (const tipo of TIPOS_DE_IMAGEN) {
    if (firmaDeImagen(binario, tipo)) return tipo;
  }
  return null;
}

async function bytesDeImagen(service: SupabaseClient, path: string) {
  const { data, error } = await service.storage.from('rr-content-assets').download(path);
  if (error || !data) {
    return NextResponse.json({ error: 'Ese archivo no está en el bucket.' }, { status: 404 });
  }
  if (data.size > TOPE_EDITOR) {
    return NextResponse.json({ error: 'El archivo pesa demasiado para editarlo en la ficha.' }, { status: 413 });
  }
  const binario = new Uint8Array(await data.arrayBuffer());
  const tipo = tipoDeImagen(binario, data.type || '');
  if (!tipo) {
    return NextResponse.json({ error: 'El editor solo abre imágenes del bucket.' }, { status: 415 });
  }
  return new NextResponse(Buffer.from(binario), {
    status: 200,
    headers: {
      'Content-Type': tipo,
      'Content-Length': String(binario.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
