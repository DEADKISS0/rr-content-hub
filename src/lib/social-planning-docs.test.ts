import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const dashboard = new URL('../components/project-dashboard.tsx', import.meta.url);
const spec = new URL('../../docs/plan-publicacion/SPEC.md', import.meta.url);
const arquitectura = new URL('../../docs/plan-publicacion/ARQUITECTURA.md', import.meta.url);

describe('entrada y documentacion del sandbox Plan de publicacion', () => {
  it('el dashboard del cliente enlaza al apartado de redes', () => {
    const texto = readFileSync(dashboard, 'utf8');

    expect(texto).toMatch(/Plan de publicación/);
    expect(texto).toMatch(/\$\{projectSlug\}\/redes/);
  });

  it('la documentacion declara que es local, mock y sin Supabase', () => {
    expect(existsSync(spec)).toBe(true);
    expect(existsSync(arquitectura)).toBe(true);
    const contenido = `${readFileSync(spec, 'utf8')}\n${readFileSync(arquitectura, 'utf8')}`;

    expect(contenido).toMatch(/Wundeer/);
    expect(contenido).toMatch(/mock local/i);
    expect(contenido).toMatch(/sin Supabase/i);
    expect(contenido).toMatch(/\/wundeer\/redes/);
    expect(contenido).toMatch(/arrastrar y soltar/i);
  });
});
