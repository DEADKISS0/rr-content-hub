import { describe, expect, it } from 'vitest';
import { resolverModoDemo } from './demo-mode';

describe('candado del modo demo', () => {
  it('permite el demo en desarrollo local', () => {
    expect(resolverModoDemo({ NEXT_PUBLIC_HUB_DEMO: 'true' })).toBe(true);
  });

  it('permite el demo en un preview aislado de Vercel', () => {
    expect(resolverModoDemo({ NEXT_PUBLIC_HUB_DEMO: 'true', VERCEL_ENV: 'preview' })).toBe(true);
  });

  it('rechaza arrancar el demo en produccion de Vercel', () => {
    expect(() => resolverModoDemo({
      NEXT_PUBLIC_HUB_DEMO: 'true',
      VERCEL_ENV: 'production',
    })).toThrow(/modo demo no puede activarse en produccion/i);
  });

  it('queda apagado si la bandera no esta activa', () => {
    expect(resolverModoDemo({ VERCEL_ENV: 'production' })).toBe(false);
  });
});
