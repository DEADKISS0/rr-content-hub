import { describe, expect, it } from 'vitest';
import { estaArchivado, marcarNombreArchivado } from './proyecto-archivado';
import { puertaDesdeFilas, type FilaProyecto } from './puerta';

describe('un proyecto archivado no es un cliente vivo', () => {
  it('null y vacío siguen abiertos', () => {
    expect(estaArchivado(null)).toBe(false);
    expect(estaArchivado(undefined)).toBe(false);
    expect(estaArchivado('')).toBe(false);
  });

  it('una fecha lo cierra', () => {
    expect(estaArchivado('2026-11-20T00:00:00.000Z')).toBe(true);
  });

  it('marca el nombre una sola vez', () => {
    expect(marcarNombreArchivado('Wundeer', null)).toBe('Wundeer');
    expect(marcarNombreArchivado('Wundeer', '2026-11-20T00:00:00.000Z')).toBe('Wundeer · ARCHIVADO');
    expect(marcarNombreArchivado('Wundeer · ARCHIVADO', '2026-11-20T00:00:00.000Z')).toBe('Wundeer · ARCHIVADO');
  });
});

describe('la puerta no ofrece un cliente archivado', () => {
  it('aunque tenga código', () => {
    const filas: FilaProyecto[] = [
      { slug: 'candilejas', name: 'CANDILEJAS', brand_primary_color: '#ded116', access_code: '2222', archived_at: null },
      { slug: 'wundeer', name: 'WUNDEER', brand_primary_color: '#be076d', access_code: '1111', archived_at: '2026-11-20T00:00:00.000Z' },
    ];
    expect(puertaDesdeFilas(filas).map((c) => c.slug)).toEqual(['candilejas']);
  });
});
