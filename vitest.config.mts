import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Configuración mínima: los tests son de lógica pura (flujo, referencias,
 * calendario), así que corren en Node sin navegador ni base de datos. El alias
 * `@` tiene que coincidir con el de `tsconfig.json` o los imports del proyecto
 * fallan dentro de los tests.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});