import { describe, expect, it, vi } from 'vitest';

import { NextRequest } from 'next/server';

/**
 * NX-1030 H1/H2 — la puerta de `/api/social-plan` medida en el handler real.
 *
 * Las dos hipótesis de este cierre, probadas donde se deciden:
 *
 *   H1 · con TABLA y SIN FILA (`via: 'session'`, rol `sin_rol`) la petición es
 *        403: una cookie válida de un cliente no lee el plan de otro. Mismo
 *        rol, misma cookie, y lo único que cambia es `via` — que es justo lo
 *        que la ruta antes no miraba.
 *   H1 · SIN TABLA (`via: 'sin-tabla'`, modo demo) la lectura se concede: el
 *        E2E sigue midiendo lo que dice medir y el recorrido de demo no se
 *        rompe.
 *   H2 · el techo de 1 MB se aplica al STREAM: sin `content-length` (chunked)
 *        también hay 413 y el almacén ni se toca.
 *
 * Los colaboradores se reemplazan completos (`vi.mock` de módulo entero) para
 * que el veredicto lo maneje la prueba y no la red.
 */
const estado = vi.hoisted(() => ({
  veredicto: null as {
    rol: string;
    email: string | null;
    puedeEscribir: boolean;
    puedeAprobar: boolean;
    via: 'session' | 'sin-sesion' | 'sin-tabla';
  } | null,
  plan: null as unknown,
  guardar: vi.fn(),
  leer: vi.fn(),
}));

vi.mock('@/lib/quien-es', () => ({
  quienEs: vi.fn(async () => ({
    email: 'lector@cliente-ajeno.test',
    nombre: 'Lector ajeno',
    proyecto: 'cliente-a',
  })),
  correoDeQuienEntra: vi.fn(async () => 'lector@cliente-ajeno.test'),
}));

vi.mock('@/lib/data', () => ({
  getProject: vi.fn(async () => ({ project: { id: 'p-wundeer' }, access: null, supabase: null })),
}));

vi.mock('@/lib/project-guard', () => ({
  rolEnProyecto: vi.fn(async () => estado.veredicto),
}));

vi.mock('@/lib/social-store', () => ({
  socialStore: vi.fn(async () => ({
    leer: estado.leer,
    historial: vi.fn(async () => []),
    guardar: estado.guardar,
  })),
}));

const { GET, PUT } = await import('./route');

function peticionGet(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/social-plan?${query}`);
}

/** Cuerpo de PUT con `content-length` SUPRIBIDO: así llega chunked, como en H2. */
function peticionPut(cuerpo: unknown, conVersion = true): NextRequest {
  const req = new NextRequest(`http://localhost/api/social-plan${conVersion ? '?v=0' : ''}`, {
    method: 'PUT',
    body: JSON.stringify(cuerpo),
    headers: { 'content-type': 'application/json' },
  });
  req.headers.delete('content-length');
  return req;
}

function veredicto(rol: string, via: 'session' | 'sin-sesion' | 'sin-tabla') {
  estado.veredicto = {
    rol,
    email: 'lector@cliente-ajeno.test',
    puedeEscribir: false,
    puedeAprobar: false,
    via,
  };
}

describe('GET /api/social-plan — SIN TABLA contra SIN FILA', () => {
  it('con tabla y sin fila: la cookie de OTRO cliente no lee ni una fila (H1)', async () => {
    veredicto('sin_rol', 'session');

    const respuesta = await GET(peticionGet('proyecto=wundeer'));

    expect(respuesta.status).toBe(403);
    const cuerpo = (await respuesta.json()) as { motivo: string };
    expect(cuerpo.motivo).toBe('sin-permiso');
    expect(estado.leer).not.toHaveBeenCalled();
  });

  it('el historial también se cierra en el mismo caso (H1)', async () => {
    veredicto('sin_rol', 'session');

    const respuesta = await GET(peticionGet('proyecto=wundeer&historial=1'));

    expect(respuesta.status).toBe(403);
  });

  it('sin tabla (modo demo): el lector sin fila sigue leyendo', async () => {
    veredicto('sin_rol', 'sin-tabla');
    estado.leer.mockResolvedValueOnce(null);

    const respuesta = await GET(peticionGet('proyecto=wundeer'));

    expect(respuesta.status).toBe(200);
    const cuerpo = (await respuesta.json()) as { plan: unknown };
    expect(cuerpo.plan).toBeNull();
  });

  it('con fila en ESTE proyecto manda la matriz: un viewer lee', async () => {
    veredicto('client_viewer', 'session');
    estado.leer.mockResolvedValueOnce(null);

    const respuesta = await GET(peticionGet('proyecto=wundeer'));

    expect(respuesta.status).toBe(200);
  });

  it('sin sesión no se lee nada: 401', async () => {
    const { quienEs } = await import('@/lib/quien-es');
    vi.mocked(quienEs).mockResolvedValueOnce(null);

    const respuesta = await GET(peticionGet('proyecto=wundeer'));

    expect(respuesta.status).toBe(401);
  });
});

describe('PUT /api/social-plan — autorización y techo', () => {
  it('con tabla y sin fila: no escribe ni toca el almacén (H1)', async () => {
    estado.guardar.mockClear();
    veredicto('sin_rol', 'session');

    const respuesta = await PUT(
      peticionPut({ projectSlug: 'wundeer', posts: [], pautas: [] }),
    );

    expect(respuesta.status).toBe(403);
    expect(estado.guardar).not.toHaveBeenCalled();
  });

  it('en modo demo el dueño sigue editando: el recorrido de escritura queda entero', async () => {
    estado.guardar.mockClear();
    estado.guardar.mockResolvedValueOnce({ ok: true, plan: { version: 1 } });
    veredicto('owner', 'sin-tabla');

    const respuesta = await PUT(
      peticionPut({ projectSlug: 'wundeer', posts: [], pautas: [] }),
    );

    expect(respuesta.status).toBe(200);
    expect(estado.guardar).toHaveBeenCalledTimes(1);
  });

  it('un aprobador no reescribe el plan: solo estado y comentario', async () => {
    estado.guardar.mockClear();
    estado.leer.mockResolvedValueOnce({
      posts: [{ id: 'p1', estado: 'pendiente', feedbackCambio: '' }],
      pautas: [],
    });
    veredicto('client_approver', 'session');

    const respuesta = await PUT(
      peticionPut({
        projectSlug: 'wundeer',
        posts: [{ id: 'p1', estado: 'aprobado', feedbackCambio: 'Bien', titulo: 'Reescrito' }],
        pautas: [],
      }),
    );

    expect(respuesta.status).toBe(403);
    expect(estado.guardar).not.toHaveBeenCalled();
  });

  it('sin ?v=N no se guarda: 400', async () => {
    estado.guardar.mockClear();
    veredicto('owner', 'session');

    const respuesta = await PUT(
      peticionPut({ projectSlug: 'wundeer', posts: [], pautas: [] }, false),
    );

    expect(respuesta.status).toBe(400);
    expect(estado.guardar).not.toHaveBeenCalled();
  });

  it('cuerpo por encima de 1 MB SIN content-length: 413 y nada llega al almacén (H2)', async () => {
    estado.guardar.mockClear();
    veredicto('owner', 'session');

    const req = new NextRequest('http://localhost/api/social-plan?v=0', {
      method: 'PUT',
      body: 'x'.repeat(1_200_000),
      headers: { 'content-type': 'application/json' },
    });
    // Sin cabecera de tamaño no hay de dónde medir: el techo tiene que estar
    // en la lectura del stream, no en `content-length`.
    expect(req.headers.get('content-length')).toBeNull();

    const respuesta = await PUT(req);

    expect(respuesta.status).toBe(413);
    expect(estado.guardar).not.toHaveBeenCalled();
  });
});
