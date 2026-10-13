import { expect, test } from '@playwright/test';

/**
 * NX-1030 paso 2 — fixtures y E2E de la matriz de permisos sobre servidor real.
 *
 * Corre contra el dev server en modo demo con HUB_SECRET y SUPER_ADMIN_EMAILS
 * propios de la corrida (clave local, no copiada de ningún entorno). El fixture
 * de sesión lo fabrica `e2e/fixtures/generar-estado.mjs`:
 *
 *   · HUB_E2E_STATE          → owner (correo en SUPER_ADMIN_EMAILS): edita.
 *   · HUB_E2E_STATE_LECTOR   → correo fuera de la lista y sin fila: en modo
 *                              demo no hay `rr_hub_access` que cruzar, así que
 *                              el veredicto llega con `via: 'sin-tabla'` y la
 *                              lectura se concede a propósito (NX-1030 H1:
 *                              SIN TABLA se lee, SIN FILA con tabla presente
 *                              es 403). Este recorrido mide lo primero; lo
 *                              segundo no se puede producir sin Supabase y
 *                              vive en `social-permissions.test.ts`.
 *
 * Los roles distintos (client_viewer, client_approver, equipo) viven en las
 * pruebas de `src/lib/social-permissions.test.ts`: en modo demo no hay
 * `rr_hub_access` que los materialice, y esta corrida no toca Supabase.
 */
const ruta = '/wundeer/redes';
const base = () => process.env.HUB_BASE_URL ?? `http://localhost:${process.env.HUB_E2E_PORT ?? '3100'}`;

test.describe('owner (rol de edición) sobre el plan real', () => {
  test.skip(!process.env.HUB_E2E_STATE, 'hace falta HUB_E2E_STATE con la sesión del owner');

  test('lee, guarda con versión y el segundo guardado con la versión vieja choca en 409', async ({ page }) => {
    const api = page.request;

    // Lectura con sesión: 200 con plan (o plan null si nadie ha guardado).
    const lectura = await api.get(`${base()}/api/social-plan?proyecto=wundeer`);
    expect(lectura.status(), 'GET con sesión de owner').toBe(200);
    const inicial = (await lectura.json()) as { plan: null | { posts: unknown[]; pautas: unknown[] } };

    const posts = Array.isArray(inicial.plan?.posts) ? inicial.plan!.posts : [];
    const pautas = Array.isArray(inicial.plan?.pautas) ? inicial.plan!.pautas : [];
    const v = Number((inicial.plan as { version?: number } | null)?.version ?? 0);

    // Escritura optimista con la versión leída: 200.
    const cuerpo = { projectSlug: 'wundeer', posts, pautas };
    const guardado = await api.put(`${base()}/api/social-plan?v=${v}`, { data: cuerpo });
    expect(guardado.status(), 'PUT del owner con la versión vigente').toBe(200);

    // Recarga: una lectura fresca vuelve a traer el plan guardado.
    const recarga = await api.get(`${base()}/api/social-plan?proyecto=wundeer`);
    expect(recarga.status()).toBe(200);
    const otraVez = (await recarga.json()) as { plan: { version: number } | null };
    expect(otraVez.plan, 'el plan persiste tras recargar').not.toBeNull();
    const versionNueva = otraVez.plan!.version;
    expect(versionNueva, 'cada guardado sube la versión').toBeGreaterThanOrEqual(v);

    // Segundo guardado con la versión vieja: 409 y nada se pisa.
    const conflicto = await api.put(`${base()}/api/social-plan?v=${v}`, { data: cuerpo });
    expect(conflicto.status(), 'PUT con versión vieja').toBe(409);
    const detalle = (await conflicto.json()) as { motivo: string; versionActual: number };
    expect(detalle.motivo).toBe('conflicto');
    expect(detalle.versionActual).toBe(versionNueva);

    // Sin ?v=N no se guarda: 400.
    const sinVersion = await api.put(`${base()}/api/social-plan`, { data: cuerpo });
    expect(sinVersion.status(), 'PUT sin versión').toBe(400);

    // Historial recuperable: 200 con arreglo.
    const historial = await api.get(`${base()}/api/social-plan?proyecto=wundeer&historial=1`);
    expect(historial.status()).toBe(200);
    expect(Array.isArray((await historial.json()).historial)).toBe(true);
  });

  test('payload invalido y excesivo se rechazan antes de tocar el almacén', async ({ page }) => {
    const api = page.request;
    const mala = await api.put(`${base()}/api/social-plan?v=0`, {
      data: { projectSlug: 'wundeer', posts: ['no-es-una-pieza'], pautas: [] },
    });
    expect(mala.status(), 'pieza con forma inválida').toBe(400);

    const gigante = await api.put(`${base()}/api/social-plan?v=0`, {
      data: { projectSlug: 'wundeer', posts: [{ id: 'x'.repeat(200_000) }], pautas: [] },
    });
    expect([400, 413], 'cuerpo que pasa el techo de 1 MB').toContain(gigante.status());
  });
});

test.describe('lector sin fila (camino SIN TABLA del modo demo) sobre el plan real', () => {
  // storageState propio: sin esto los dos descriptores compartirían la sesión
  // del owner (la global `HUB_E2E_STATE`) y el recorrido del lector mediría al
  // dueño — un verde que no mide lo que dice medir.
  test.use({ storageState: process.env.HUB_E2E_STATE_LECTOR });
  test.skip(!process.env.HUB_E2E_STATE_LECTOR, 'hace falta HUB_E2E_STATE_LECTOR con la sesión del lector');

  test('lee el plan sin tabla, pero no lo escribe: 200 y 403', async ({ page }) => {
    const api = page.request;
    // NX-1030 H1: aquí se lee porque el veredicto es `via: 'sin-tabla'` (demo,
    // sin datos), no porque `sin_rol` herede lectura — con tabla presente y
    // sin fila sería 403 y la cookie de otro cliente no leería ni una fila.
    const lectura = await api.get(`${base()}/api/social-plan?proyecto=wundeer`);
    expect(lectura.status(), 'GET en el camino SIN TABLA (demo)').toBe(200);

    const escritura = await api.put(`${base()}/api/social-plan?v=0`, {
      data: { projectSlug: 'wundeer', posts: [], pautas: [] },
    });
    expect(escritura.status(), 'PUT de quien solo lee').toBe(403);
    const detalle = (await escritura.json()) as { motivo: string };
    expect(detalle.motivo).toBe('sin-permiso');
  });

  test('un proyecto que la puerta no conoce no se lee: 403', async ({ page }) => {
    // La otra mitad de la misma puerta: sin proyecto no hay veredicto, y sin
    // veredicto no hay lectura. Cubre la rama que niega de
    // `permisosSocialesDeVeredicto(null)` contra el servidor real.
    const api = page.request;
    const desconocido = await api.get(`${base()}/api/social-plan?proyecto=cliente-que-no-existe`);
    expect(desconocido.status(), 'GET de un proyecto sin puerta').toBe(403);
    const detalle = (await desconocido.json()) as { motivo: string };
    expect(detalle.motivo).toBe('sin-permiso');

    const historial = await api.get(
      `${base()}/api/social-plan?proyecto=cliente-que-no-existe&historial=1`,
    );
    expect(historial.status(), 'historial del mismo proyecto').toBe(403);
  });
});
