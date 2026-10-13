import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const nextConfig = new URL('../../next.config.ts', import.meta.url);

describe('CSP para prototipo Wundeer', () => {
  it('permite embeber el prototipo de Railway en Plan de publicación', () => {
    const contenido = readFileSync(nextConfig, 'utf8');

    expect(contenido).toMatch(/frame-src/);
    expect(contenido).toMatch(/commerce-wundeer-beta\.up\.railway\.app/);
  });
});
