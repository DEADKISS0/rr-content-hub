import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('NEXT_PUBLIC_HUB_DEMO', 'true');
vi.mock('./supabase/service', () => ({
  createServiceClient: vi.fn(async () => null),
}));
vi.mock('./supabase/server', () => ({
  createClient: vi.fn(async () => null),
}));
vi.mock('./quien-es', () => ({
  quienEs: vi.fn(async () => null),
}));

const { clienteExiste } = await import('./projects');
const { getProject, getProjects } = await import('./data');

describe('modo demo local del Content Hub', () => {
  it('reconoce Wundeer sin Supabase cuando NEXT_PUBLIC_HUB_DEMO=true', async () => {
    await expect(clienteExiste('wundeer')).resolves.toBe(true);
    await expect(clienteExiste('cliente-inventado')).resolves.toBe(false);
  });

  it('entrega el proyecto Wundeer mock para rutas locales sin Supabase', async () => {
    const { project, access, supabase } = await getProject('wundeer');

    expect(project).toMatchObject({ slug: 'wundeer', name: 'WUNDEER', client_name: expect.stringContaining('Moda') });
    expect(access).toBeNull();
    expect(supabase).toBeNull();
  });

  it('lista proyectos demo para el dashboard local sin Supabase', async () => {
    const { projects, supabase } = await getProjects();

    expect(supabase).toBeNull();
    expect(projects).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'wundeer' })]));
  });
});
