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
