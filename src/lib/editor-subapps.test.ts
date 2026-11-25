import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { stripWasmNames } from '../../scripts/strip-wasm-names';

describe('RR editor subapplications', () => {
  it('las rutas de ficha redirigen a las aplicaciones vendored', () => {
    const foto = readFileSync(new URL('../app/[projectSlug]/editar/foto/page.tsx', import.meta.url), 'utf8');
    const video = readFileSync(new URL('../app/[projectSlug]/editar/video/page.tsx', import.meta.url), 'utf8');
    expect(foto).toContain("redirect('/editors/rr-imagen/index.html')");
    expect(video).toContain("redirect('/editors/rr-motion/index.html')");
  });

  it('los builds completos existen en public', () => {
    const root = join(process.cwd(), 'public/editors');
    expect(existsSync(join(root, 'rr-imagen/index.html'))).toBe(true);
    expect(existsSync(join(root, 'rr-motion/index.html'))).toBe(true);
  });

  it('los editores permiten compilar WebAssembly sin abrir unsafe-eval al resto del hub', async () => {
    const headers = await nextConfig.headers?.();
    const editorRule = headers?.find((rule) => rule.source === '/editors/:path*');
    const csp = editorRule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value;

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it('los assets pesados de los editores se cachean como inmutables', async () => {
    const headers = await nextConfig.headers?.();
    const immutableSources = headers
      ?.filter((rule) => rule.headers.some((header) => header.value.includes('immutable')))
      .map((rule) => rule.source);

    expect(immutableSources).toEqual(expect.arrayContaining([
      '/editors/rr-imagen/:path(.*\\.wasm)',
      '/editors/rr-motion/:path(.*\\.wasm)',
      '/editors/rr-motion/filmcraft_web.js',
    ]));
  });

  it('RR Motion descarga JavaScript y WASM en paralelo desde el HTML', () => {
    const motion = readFileSync(new URL('../../public/editors/rr-motion/index.html', import.meta.url), 'utf8');

    expect(motion).toMatch(/rel="modulepreload"[^>]+filmcraft_web\.js/);
    expect(motion).toMatch(/rel="preload"[^>]+filmcraft_web_bg\.wasm[^>]+as="fetch"[^>]+type="application\/wasm"/);
  });

  it('RR Motion no conserva la sección de nombres de 7,4 MB', () => {
    const wasm = readFileSync(new URL('../../public/editors/rr-motion/filmcraft_web_bg.wasm', import.meta.url));

    expect(stripWasmNames(wasm).removed).toBe(0);
    expect(wasm.length).toBeLessThan(42 * 1024 * 1024);
  });
});
