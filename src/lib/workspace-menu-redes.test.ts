import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const shell = new URL('../components/workspace-shell.tsx', import.meta.url);

describe('menu lateral del hub', () => {
  it('incluye acceso directo al Plan de publicacion del cliente', () => {
    const contenido = readFileSync(shell, 'utf8');

    expect(contenido).toMatch(/PLAN DE PUBLICACIÓN/);
    expect(contenido).toMatch(/path: '\/redes'/);
    expect(contenido).toMatch(/icon: 'publish'/);
  });
});
