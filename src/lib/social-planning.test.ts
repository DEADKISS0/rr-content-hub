import { describe, expect, it } from 'vitest';
import {
  aprobarPublicacion,
  moverPublicacion,
  planPublicacionDe,
  portadaDePublicacion,
  publicacionesOrdenadas,
  reordenarPublicaciones,
  solicitarCambios,
} from './social-planning';

describe('Plan de publicacion de Wundeer', () => {
  it('Wundeer tiene un plan mock local con perfil, 9 publicaciones organicas, pautas y prototipo', () => {
    const plan = planPublicacionDe('wundeer');

    expect(plan).not.toBeNull();
    expect(plan?.nombreVisible).toBe('Plan de publicación');
    expect(plan?.perfil.usuario).toBe('wundeer.co');
    expect(plan?.perfil.logo).toContain('wundeer');
    expect(plan?.prototipo.url).toBe('https://commerce-wundeer-beta.up.railway.app/');
    expect(plan?.publicaciones).toHaveLength(9);
    expect(plan?.pautas).toHaveLength(3);
    expect(plan?.publicaciones.map((p) => p.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(plan?.pautas.map((p) => p.slot)).toEqual([1, 2, 3]);
  });

  it('un cliente sin plan no recibe el mock de Wundeer', () => {
    expect(planPublicacionDe('boga')).toBeNull();
    expect(planPublicacionDe('')).toBeNull();
    expect(planPublicacionDe(undefined)).toBeNull();
  });

  it('ordena por slot aunque el arreglo llegue revuelto', () => {
    const plan = planPublicacionDe('wundeer');
    const revueltas = [...(plan?.publicaciones ?? [])].reverse();

    expect(publicacionesOrdenadas(revueltas).map((p) => p.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('reordena una publicacion de un slot a otro sin perder IDs ni duplicar slots', () => {
    const plan = planPublicacionDe('wundeer');
    const publicaciones = plan?.publicaciones ?? [];
    const movida = publicaciones[0];

    const nuevas = reordenarPublicaciones(publicaciones, movida.id, 5);

    expect(nuevas.find((p) => p.id === movida.id)?.slot).toBe(5);
    expect(new Set(nuevas.map((p) => p.id)).size).toBe(9);
    expect(nuevas.map((p) => p.slot).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('moverPublicacion cambia una pieza hacia adelante o atras en la grilla', () => {
    const plan = planPublicacionDe('wundeer');
    const publicaciones = plan?.publicaciones ?? [];
    const segunda = publicaciones[1];

    const atras = moverPublicacion(publicaciones, segunda.id, 'atras');
    expect(atras.find((p) => p.id === segunda.id)?.slot).toBe(1);

    const adelante = moverPublicacion(publicaciones, segunda.id, 'adelante');
    expect(adelante.find((p) => p.id === segunda.id)?.slot).toBe(3);
  });

  it('cada publicacion se aprueba de forma individual', () => {
    const plan = planPublicacionDe('wundeer');
    const publicaciones = plan?.publicaciones ?? [];
    const objetivo = publicaciones[3];

    const nuevas = aprobarPublicacion(publicaciones, objetivo.id, 'aprobado');

    expect(nuevas.find((p) => p.id === objetivo.id)?.estado).toBe('aprobado');
    expect(nuevas.filter((p) => p.estado === 'aprobado')).toHaveLength(1);
  });

  it('usa una portada separada para la grilla cuando el video o Drive no la trae', () => {
    const post = planPublicacionDe('wundeer')?.publicaciones[0];
    expect(post).toBeDefined();
    expect(portadaDePublicacion({ ...post!, portadaUrl: '/portada.jpg' })).toBe('/portada.jpg');
    expect(portadaDePublicacion({ ...post!, portadaUrl: '' })).toBe(post?.mediaUrl);
  });

  it('pedir cambios exige comentario y lo conserva en la publicacion', () => {
    const publicaciones = planPublicacionDe('wundeer')?.publicaciones ?? [];
    const objetivo = publicaciones[0];

    expect(() => solicitarCambios(publicaciones, objetivo.id, '   ')).toThrow(/comentario/i);

    const nuevas = solicitarCambios(publicaciones, objetivo.id, 'Cambiar el primer plano por producto.');
    const actualizada = nuevas.find((post) => post.id === objetivo.id);
    expect(actualizada?.estado).toBe('cambios');
    expect(actualizada?.feedbackCambio).toBe('Cambiar el primer plano por producto.');
  });
});
