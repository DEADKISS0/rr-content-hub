import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decidirPortada, esImagenPintable, urlDePortada } from './idea-cover';

/**
 * La portada de una idea, de la columna a la tarjeta.
 *
 * Este archivo cubre las dos mitades que se pueden comprobar sin base de datos:
 *
 *   1. La MIGRACIÓN existe y es coherente. Se lee el SQL del disco y se
 *      comprueba que declara la columna, el helper y los índices. Es la misma
 *      idea que `scripts/verify-*.mjs`, pero como test: si alguien borra la
 *      columna del SQL, la suite se cae aquí y no en producción.
 *   2. La DECISIÓN de pintar. Si hay brief que sea imagen, la imagen; si no,
 *      el placeholder con el título.
 *
 * Lo que NO se puede comprobar desde acá — que la función de Postgres ejecute y
 * devuelva la fila correcta — necesita la base de datos y se verifica
 * apply-and-read sobre el stack, no en vitest. Decirlo aquí evita que alguien
 * lea "todo verde" y crea que la función ya corrió.
 */

const MIGRATION = fileURLToPath(
  new URL('../../supabase/migrations/20260928_hub_idea_cover.sql', import.meta.url),
);
const sql = fs.readFileSync(MIGRATION, 'utf8');

/**
 * La correctiva: la migración original se aplicó y aun así dejó el embed de
 * PostgREST roto (sin FK) y el helper ejecutable por `anon`. Estos dos archivos
 * se leen del disco igual que el primero, y sus casos están en la misma suite
 * porque el defecto no estaba en el SQL, sino en lo que el SQL prometería.
 */
const CORRECTIVA = fileURLToPath(
  new URL(
    '../../supabase/migrations/20260928_hub_idea_cover_fk_and_grants.sql',
    import.meta.url,
  ),
);
const correctiva = fs.readFileSync(CORRECTIVA, 'utf8');

/** El módulo de datos es donde vive la consulta que se rompía en silencio. */
const data = fs.readFileSync(
  fileURLToPath(new URL('./data.ts', import.meta.url)),
  'utf8',
);

/** La migración que fija el filtro del bucket, y el cliente que debe calcarlo. */
const bucketSql = fs.readFileSync(
  fileURLToPath(
    new URL(
      '../../supabase/migrations/20260928_hub_bucket_solo_imagenes.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const cliente = fs.readFileSync(
  fileURLToPath(new URL('./workspace-client.ts', import.meta.url)),
  'utf8',
);

const asset = (over: Partial<Parameters<typeof esImagenPintable>[0]> = {}) => ({
  mime_type: 'image/jpeg',
  external_url: 'https://cdn.rraliados.com/briefs/o1.jpg',
  file_name: 'brief.jpg',
  ...over,
});

/** Asset completo del RPC, para los casos que se pasan a `urlDePortada`. */
const cover = (over: Partial<NonNullable<Parameters<typeof urlDePortada>[0]>> = {}) => ({
  asset_id: 'a1',
  file_name: 'brief.jpg',
  mime_type: 'image/jpeg',
  external_url: 'https://cdn.rraliados.com/briefs/o1.jpg',
  storage_path: null as string | null,
  ...over,
});

describe('migración de portada (20260928_hub_idea_cover)', () => {
  it('el archivo de migración existe', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true);
  });

  it('añade cover_asset_id a rr_hub_ideas apuntando a rr_hub_assets', () => {
    expect(sql).toMatch(/add column if not exists cover_asset_id uuid/i);
    expect(sql).toMatch(/references public\.rr_hub_assets\(id\)/i);
  });

  it('es reejecutable: si se aplica dos veces no falla ni duplica', () => {
    expect(sql).toMatch(/add column if not exists/i);
    expect(sql).toMatch(/create index if not exists/i);
    expect(sql).toMatch(/create or replace function/i);
  });

  it('no borra la idea si se borra la portada', () => {
    // set null, no cascade: perder el archivo no puede borrar la idea.
    expect(sql).toMatch(/on delete set null/i);
    expect(sql).not.toMatch(/on delete cascade[\s\S]{0,80}cover_asset/i);
  });

  it('crea el helper rr_hub_idea_cover', () => {
    expect(sql).toMatch(/create or replace function public\.rr_hub_idea_cover\(p_idea_id uuid\)/i);
  });

  it('el helper primero respeta la portada elegida y después cae a la más reciente', () => {
    expect(sql).toMatch(/cover_asset_id is not null/i);
    expect(sql).toMatch(/asset_stage = 'reference_brief'/i);
    expect(sql).toMatch(/order by b\.created_at desc/i);
  });

  it('el helper NO se le concede a anon', () => {
    // El hub público expone lecturas a anon (docs/AUDIT_2026-09-26.md). Darle
    // execute a anon abriría los storage_path de briefs de otras ideas.
    const grant = sql.match(/grant execute on function public\.rr_hub_idea_cover\(uuid\)[^;]+;/i);
    expect(grant, 'falta el grant').toBeTruthy();
    expect(grant![0]).toMatch(/to authenticated/i);
    expect(grant![0]).not.toMatch(/anon/i);
  });

  it('el helper comprueba la autorización a mano, porque es security definer', () => {
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public/i);
    // Si no revalida, salta las RLS de rr_hub_assets y filtra.
    expect(sql).toMatch(/rr_hub_is_admin\(\)/i);
    expect(sql).toMatch(/rr_hub_access/i);
  });

  // ── Lo que el SQL anterior NO cumplía (verificado en la base, 2026-09-28) ──
  //
  // Estos tres casos nacen de medir, no de leer: la migración original se aplicó
  // sin error y aun así dejaba el embed roto y el RPC abierto a `anon`.

  it('la migración correctiva crea la FK que PostgREST necesita para el embed', () => {
    // Sin FK, `?select=cover_asset_id(...)` responde 400 PGRST200 y conPortadas()
    // se come el error: el tablero pintaba siempre el arte de marca.
    expect(correctiva).toMatch(/add constraint rr_hub_ideas_cover_asset_id_fkey/i);
    expect(correctiva).toMatch(/references public\.rr_hub_assets\(id\)/i);
    expect(correctiva).toMatch(/on delete set null/i);
  });

  it('la correctiva revoca a PUBLIC y a anon, no solo concede a authenticated', () => {
    // En Postgres las funciones NACEN con EXECUTE para PUBLIC: un `grant` a
    // authenticated sin `revoke` deja a `anon` con permiso. Medido: anon
    // llamaba el RPC y recibía 200.
    expect(correctiva).toMatch(/revoke execute on function public\.rr_hub_idea_cover\(uuid\)\s+from public/i);
    expect(correctiva).toMatch(/revoke execute on function public\.rr_hub_idea_cover\(uuid\)\s+from anon/i);
    // Y el revoke tiene que ir ANTES del grant, o el grant lo repone.
    const iRevoke = correctiva.search(/revoke execute on function public\.rr_hub_idea_cover\(uuid\)\s+from public/i);
    const iGrant = correctiva.search(/grant\s+execute on function public\.rr_hub_idea_cover\(uuid\)\s+to authenticated/i);
    expect(iRevoke).toBeGreaterThanOrEqual(0);
    expect(iGrant).toBeGreaterThan(iRevoke);
  });

  it('el embed de la app se llama cover_asset_id, no cover_asset', () => {
    // PostgREST resuelve la relación por el NOMBRE de la columna. Con la FK
    // puesta, `cover_asset(id,...)` sigue dando 400 PGRST200; el alias corto se
    // escribe con dos puntos. Este test es el que impide volver a perder la
    // portada sin que nadie lo note.
    expect(data).toMatch(/cover_asset:cover_asset_id\(/);
    expect(data).not.toMatch(/select\('id, cover_asset\(/);
  });

  it('las consultas de portada comprueban `error` en vez de confiar en try/catch', () => {
    // supabase-js no lanza: una consulta rota vuelve como {data: null, error}.
    // Con un `try/catch` el PGRST200 pasaba por "no hay portada" sin dejar rastro.
    expect(data).toMatch(/no se pudieron leer las portadas elegidas/);
    expect(data).toMatch(/no se pudieron leer los briefs de portada/);
  });

  it('el embed a UNA columna se lee como objeto, no como array', () => {
    // Este es el fallo que hacia invisible la portada CON la base ya bien
    // puesta. PostgREST devuelve un objeto cuando el embed apunta a una sola
    // fila y un array cuando puede traer varias; `cover_asset_id` es una
    // columna, o sea una sola fila. El `?.[0]` de siempre devolvía `undefined`
    // sobre el objeto y la tarjeta caía al arte de marca sin avisar.
    // Medido el 2026-09-28 con las 3 portadas subidas a O1, O10 y O11.
    expect(data).toMatch(/Array\.isArray\(bruto\)/);
    // Y el `?.[0]` sobre `fila.cover_asset` no puede volver: es el bug.
    expect(data).not.toMatch(/fila\.cover_asset as unknown\[\] \| null\)\?\.\[0\]/);
  });

  it('el filtro del bucket es solo imagenes y sin comodines', () => {
    // Storage compara `allowed_mime_types` por igualdad EXACTA: con `image/`
    // en la lista, `image/png` daba 415 y no se podia subir ninguna portada.
    // Decision de Santiago (2026-09-28): solo imagenes, sin video.
    // Lo que importa es la LISTA que se escribe, no el archivo entero: el
    // comentario del final menciona `video/mp4` a proposito, para explicar por
    // que ese ahora da 415. Mirar el archivo entero daria un falso positivo.
    const lista = bucketSql.match(
      /set allowed_mime_types = array\[([\s\S]*?)\]/i,
    );
    expect(lista, 'no se encuentra la lista de mimes en el UPDATE').toBeTruthy();
    expect(lista![1]).toMatch(/image\/png/);
    expect(lista![1]).toMatch(/image\/jpeg/);
    // Ni comodines (que storage no implementa) ni video (que no se quiere).
    expect(lista![1]).not.toMatch(/'image\/'/);
    expect(lista![1]).not.toMatch(/video/);
  });

  it('el filtro del CLIENTE es el mismo que el del bucket, tipo por tipo', () => {
    // Si el cliente acepta algo que el bucket rechaza, el error aparece como un
    // 415 de storage DESPUES de que el usuario ya eligio el archivo: el mensaje
    // llega tarde y no dice que hacer. Medido el 2026-09-28: `uploadAsset()`
    // admitia `video/`, PDF y DOCX mientras el bucket ya no.
    // Los dos filtros tienen que decir LO MISMO, no "casi lo mismo".
    const enBucket = new Set(
      (bucketSql.match(/set allowed_mime_types = array\[([\s\S]*?)\]/i)![1].match(
        /'(image\/[a-z]+)'/gi,
      ) ?? []).map((m) => m.replace(/'/g, '')),
    );
    const enCliente = new Set(
      (cliente.match(/const BUCKET_MIMES = \[([\s\S]*?)\]/i)![1].match(
        /'(image\/[a-z]+)'/gi,
      ) ?? []).map((m) => m.replace(/'/g, '')),
    );
    expect(enCliente.size).toBeGreaterThan(0);
    expect([...enBucket].sort()).toEqual([...enCliente].sort());
  });
});

describe('qué se puede pintar como portada', () => {
  it('una imagen con URL pública sí se pinta', () => {
    expect(esImagenPintable(asset())).toBe(true);
    expect(urlDePortada(cover())).toBe('https://cdn.rraliados.com/briefs/o1.jpg');
  });

  it('un storage_path del bucket privado NO se pinta: da 403 sin firma', () => {
    // El bucket es privado. Poner la ruta cruda en un src no abre nada, y sin
    // embargo parece una portada válida: ese es el fallo que hay que impedir.
    expect(esImagenPintable(asset({ external_url: null, file_name: 'brief.jpg' }))).toBe(false);
    expect(urlDePortada(cover({ external_url: null, storage_path: 'ideas/o1/brief.jpg' }))).toBeNull();
  });

  it('un brief que no es imagen no se pinta', () => {
    expect(esImagenPintable(asset({ mime_type: 'application/pdf', file_name: 'brief.pdf' }))).toBe(false);
    expect(esImagenPintable(asset({ mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toBe(false);
  });

  it('el mime_type manda sobre la extensión del nombre', () => {
    // Un brief.jpg que en realidad es PDF: si se fiara del nombre, la tarjeta
    // pintaría el ícono de imagen rota del navegador.
    expect(esImagenPintable(asset({ mime_type: 'application/pdf', file_name: 'brief.jpg' }))).toBe(false);
  });

  it('sin mime_type se cae a la extensión del nombre', () => {
    expect(esImagenPintable(asset({ mime_type: null, file_name: 'brief.png' }))).toBe(true);
    expect(esImagenPintable(asset({ mime_type: null, file_name: 'brief.pdf' }))).toBe(false);
  });

  it('acepta los formatos de imagen que se suben de verdad', () => {
    for (const nombre of ['a.jpg', 'a.jpeg', 'a.png', 'a.webp', 'a.gif', 'a.avif']) {
      expect(esImagenPintable(asset({ mime_type: null, file_name: nombre })), nombre).toBe(true);
    }
  });
});

describe('la tarjeta: imagen si se puede, placeholder si no', () => {
  it('con brief de imagen se muestra la imagen', () => {
    const d = decidirPortada({ title: 'Pan con queso', code: 'O1' }, cover());
    expect(d.kind).toBe('imagen');
    if (d.kind === 'imagen') {
      expect(d.url).toBe('https://cdn.rraliados.com/briefs/o1.jpg');
      // El alt lleva código Y título: para un lector de pantalla, la imagen
      // tiene que decir de qué pieza es.
      expect(d.alt).toContain('O1');
      expect(d.alt).toContain('Pan con queso');
    }
  });

  it('sin brief se muestra el placeholder, nunca un hueco vacío', () => {
    expect(decidirPortada({ title: 'Pan con queso', code: 'O1' }, null).kind).toBe('placeholder');
  });

  it('con brief que es PDF se cae al placeholder', () => {
    const d = decidirPortada({ title: 'Pan con queso', code: 'O1' }, cover({
      file_name: 'b.pdf', mime_type: 'application/pdf',
      external_url: 'https://cdn.rraliados.com/briefs/o1.pdf',
    }));
    expect(d.kind).toBe('placeholder');
  });

  it('sin código, el alt igual nombra la pieza', () => {
    const d = decidirPortada({ title: 'Pan con queso' }, cover({ external_url: 'https://cdn.test/b.jpg' }));
    if (d.kind === 'imagen') expect(d.alt).toBe('Portada de la idea: Pan con queso');
  });
});
