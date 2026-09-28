-- El bucket solo acepta imagenes. Los comodines `image/` y `video/` que
-- traia no funcionan: storage compara `allowed_mime_types` por IGUALDAD
-- EXACTA, no por prefijo.
-- 2026-09-28 · proyecto Wundeer
--
-- Por que esto existe (medido, no supuesto). Con la lista anterior:
--
--   Content-Type enviado   Respuesta
--   ────────────────────   ────────────────────────────────
--   application/pdf        403 RLS → pasa el filtro
--   image/png              415 InvalidMimeType
--   video/mp4              415 InvalidMimeType
--   text/plain             415 InvalidMimeType
--
-- Es decir: el bucket RECHAZABA toda imagen, y el hub sube precisamente
-- imagenes — las portadas de las piezas. El filtro se escribio con una
-- convencion de comodin que storage-api no implementa.
--
-- Decision de Santiago (2026-09-28): solo imagenes, sin video. Por eso esta
-- lista NO incluye video/* ni los documentos que traia. El limite de tamano
-- (100 MB) y el bucket publico se quedan como estaban.
--
-- Con esto el brief tiene que ser una imagen. Un PDF o un DOCX ya no se puede
-- subir como `reference_brief`: el caso de uso era la foto de referencia, no un
-- documento. Si alguna vez hace falta guardar un documento, que vaya a OTRO
-- bucket con su propio filtro, no a este: un filtro con dos propositos se
-- cumple con ninguno.
--
-- Los tipos son los que un navegador produce de verdad al hacer drag & drop o
-- elegir un archivo. `startsWith('image/')` en el cliente (workspace-client.ts
-- uploadAsset) es mas ancho que esta lista: puede dejar pasar un `image/tiff`
-- que storage rechaza. Se acepta esa diferencia a proposito — el filtro del
-- servidor es el que manda, y un 415 con mensaje claro es mejor que un
-- archivo raro guardado y luego ilegible en la tarjeta.

update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/gif',
         'image/avif',
         'image/heic',
         'image/heif'
       ],
       updated_at = now()
 where id = 'rr-content-assets';

-- Verificacion (tiene que devolver 7):
--   select array_length(allowed_mime_types, 1) from storage.buckets
--    where id = 'rr-content-assets';
--
-- Y la prueba que de verdad importa, porque el filtro se comprueba al SUBIR y
-- no al leer: con la anon key, un POST a
--   /storage/v1/object/rr-content-assets/<cualquier>/x.png
-- con Content-Type: image/png debe dar 403 (pasa el filtro, muere en RLS) y NO
-- 415. Antes daba 415. Un 403 aqui es la prueba de que el filtro ya no bloquea
-- las imagenes: el unico motivo que queda es el permiso, que es lo correcto.
