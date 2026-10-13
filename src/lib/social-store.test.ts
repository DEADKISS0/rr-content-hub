// NX-1028 — pruebas de la capa de persistencia del plan de publicación.
// Cubren: lectura/escritura, control de concurrencia (409), historial,
// archivado recuperable y que el almacén local no se sale de su raíz.
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LocalFileSocialStore, socialStore } from '@/lib/social-store';
import type { SocialPost } from '@/lib/social-planning';

let raiz: string;
let store: LocalFileSocialStore;
let dirOriginal: string | undefined;

function post(id: string, slot: number): SocialPost {
  return {
    id,
    slot,
    tipo: 'foto',
    titulo: `Título ${id}`,
    caption: 'Caption',
    hashtags: ['rr'],
    mediaUrl: '/mock/x.svg',
    portadaUrl: '/mock/x.svg',
    color: '#be076d',
    estado: 'pendiente',
    fechaSugerida: 'Lunes 9:00 a. m.',
  };
}

beforeAll(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'social-store-'));
  dirOriginal = process.env.RR_HUB_SOCIAL_DIR;
  process.env.RR_HUB_SOCIAL_DIR = raiz;
  store = new LocalFileSocialStore();
});

afterAll(async () => {
  if (dirOriginal === undefined) delete process.env.RR_HUB_SOCIAL_DIR;
  else process.env.RR_HUB_SOCIAL_DIR = dirOriginal;
  await rm(raiz, { recursive: true, force: true });
});

beforeEach(async () => {
  const { rm: rmFile } = await import('node:fs/promises');
  await rmFile(path.join(raiz, 'wundeer.json'), { force: true });
});

describe('LocalFileSocialStore', () => {
  it('lee null cuando nadie ha guardado (no es un error)', async () => {
    expect(await store.leer('wundeer')).toBeNull();
  });

  it('guarda y devuelve la versión 1', async () => {
    const resultado = await store.guardar(
      { projectSlug: 'wundeer', posts: [post('a', 1)], pautas: [], updatedBy: 'Santiago' },
      0,
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.plan.version).toBe(1);

    const leido = await store.leer('wundeer');
    expect(leido?.posts).toHaveLength(1);
    expect(leido?.updatedBy).toBe('Santiago');
  });

  it('rechaza la escritura con una versión vieja y no pisa nada (conflicto)', async () => {
    await store.guardar({ projectSlug: 'wundeer', posts: [post('a', 1)], pautas: [], updatedBy: 'Ana' }, 0);
    const segundo = await store.guardar(
      { projectSlug: 'wundeer', posts: [post('a', 1), post('b', 2)], pautas: [], updatedBy: 'Beto' },
      1,
    );
    expect(segundo.ok).toBe(true);

    // Ana sigue con la versión 1 en pantalla y manda su guardado.
    const pisada = await store.guardar(
      { projectSlug: 'wundeer', posts: [post('a', 1)], pautas: [], updatedBy: 'Ana' },
      1,
    );
    expect(pisada.ok).toBe(false);
    if (!pisada.ok) {
      expect(pisada.motivo).toBe('conflicto');
      expect(pisada.versionActual).toBe(2);
    }
    // El plan del servidor sigue siendo el de Beto: dos posts.
    expect((await store.leer('wundeer'))?.posts).toHaveLength(2);
  });

  it('deja historial de cada escritura y se puede restaurar', async () => {
    await store.guardar({ projectSlug: 'wundeer', posts: [post('a', 1)], pautas: [], updatedBy: 'Ana' }, 0);
    await store.guardar(
      { projectSlug: 'wundeer', posts: [post('a', 1), post('b', 2)], pautas: [], updatedBy: 'Beto' },
      1,
    );
    const entradas = await store.historial('wundeer');
    expect(entradas).toHaveLength(2);
    expect(entradas[0].version).toBe(0);

    // La entrada del historial con `version 1` es el estado ANTES del segundo
    // guardado: el plan de una sola publicación. (La `version 0` es el plan
    // vacío previo a existir.)
    const restaurado = await store.restaurar('wundeer', 1, 'Santiago');
    expect(restaurado.ok).toBe(true);
    expect((await store.leer('wundeer'))?.posts).toHaveLength(1);
    // La restauración no borra: el historial crece.
    expect((await store.historial('wundeer')).length).toBeGreaterThan(2);
  });

  it('archiva una publicación sin borrado irreversible y se recupera', async () => {
    await store.guardar(
      { projectSlug: 'wundeer', posts: [post('a', 1), post('b', 2)], pautas: [], updatedBy: 'Ana' },
      0,
    );
    const archivado = await store.archivar('wundeer', 'organico', 'b', 'Santiago');
    expect(archivado.ok).toBe(true);
    expect((await store.leer('wundeer'))?.posts).toHaveLength(1);

    // Recuperable: la copia previa al archivado (versión 1) sigue en el historial.
    const restaurado = await store.restaurar('wundeer', 1, 'Santiago');
    expect(restaurado.ok).toBe(true);
    expect((await store.leer('wundeer'))?.posts).toHaveLength(2);
  });

  it('devuelve no-encontrado para un proyecto o un id que no existe', async () => {
    expect((await store.archivar('nadie', 'organico', 'x', 'Ana')).ok).toBe(false);
    await store.guardar({ projectSlug: 'wundeer', posts: [post('a', 1)], pautas: [], updatedBy: 'Ana' }, 0);
    const malo = await store.archivar('wundeer', 'pauta', 'no-existe', 'Ana');
    expect(malo.ok).toBe(false);
    if (!malo.ok) expect(malo.motivo).toBe('no-encontrado');
  });

  it('rechaza un plan con ids repetidos o proyecto vacío', async () => {
    const repetido = await store.guardar(
      { projectSlug: 'wundeer', posts: [post('a', 1), post('a', 2)], pautas: [], updatedBy: 'Ana' },
      0,
    );
    expect(repetido.ok).toBe(false);
    const sinSlug = await store.guardar({ projectSlug: '  ', posts: [], pautas: [], updatedBy: 'Ana' }, 0);
    expect(sinSlug.ok).toBe(false);
  });

  it('normaliza el slug: un intento de salida del directorio no escribe fuera', async () => {
    await store.guardar(
      { projectSlug: '../../fuera', posts: [post('a', 1)], pautas: [], updatedBy: 'Ana' },
      0,
    );
    await expect(readFile(path.join(raiz, '..', '..', 'fuera.json'), 'utf8')).rejects.toThrow();
    const dentro = path.join(raiz, 'fuera.json');
    await expect(readFile(dentro, 'utf8')).resolves.toContain('"version": 1');
  });

  it('socialStore() entrega el almacén local (nunca el remoto por defecto)', async () => {
    const porDefecto = await socialStore();
    expect(porDefecto).toBeInstanceOf(LocalFileSocialStore);
  });
});
