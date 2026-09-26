// Hook de resolucion: mapea `@/x` a `<repo>/src/x` para que los tests puedan
// importar los modulos de la app tal cual los importa Next.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(repoRoot, 'src', specifier.slice(2));
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true, format: 'module-typescript' };
      }
    }
  }
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : repoRoot;
    const base = path.resolve(path.dirname(parentPath), specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true, format: 'module-typescript' };
      }
    }
  }
  return nextResolve(specifier, context);
}
