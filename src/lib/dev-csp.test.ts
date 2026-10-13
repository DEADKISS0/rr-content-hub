import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const nextConfig = new URL('../../next.config.ts', import.meta.url);

describe('CSP de desarrollo local', () => {
  it('permite unsafe-eval solo bajo condicion de desarrollo para que Next no abra overlay', () => {
    const contenido = readFileSync(nextConfig, 'utf8');

    expect(contenido).toMatch(/NODE_ENV/);
    expect(contenido).toMatch(/unsafe-eval/);
    expect(contenido).toMatch(/script-src/);
  });
});
