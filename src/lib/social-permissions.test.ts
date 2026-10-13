import { describe, expect, it } from 'vitest';

import { ROLE_KEYS } from '@/lib/flow';
import type { SocialPost } from '@/lib/social-planning';
import {
  esRolSocialConocido,
  MOTIVO_SIN_PERMISO,
  permisosSociales,
  permisosSocialesDeVeredicto,
  SIN_ACCESO,
  soloCambioDeAprobacion,
} from '@/lib/social-permissions';

function post(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'w-post-01',
    slot: 1,
    tipo: 'reel',
    titulo: 'Del boceto a la prenda',
    caption: 'Así nace una colección.',
    hashtags: ['wundeer'],
    mediaUrl: '/mock/social/wundeer-01.svg',
    portadaUrl: '/mock/social/wundeer-01.svg',
    color: '#be076d',
    estado: 'pendiente',
    fechaSugerida: 'Lunes 9:00 a. m.',
    ...overrides,
  };
}

describe('matriz de acceso del plan de publicación', () => {
  it('el visitante no tiene acceso: ni leer, ni escribir, ni aprobar', () => {
    for (const sinSesion of [null, undefined, 'visitante']) {
      expect(permisosSociales(sinSesion)).toEqual({
        puedeLeer: false, puedeEditar: false, puedeAprobar: false, puedeBorrar: false,
      });
    }
  });

  it('client_viewer solo lee', () => {
    expect(permisosSociales('client_viewer')).toEqual({
      puedeLeer: true, puedeEditar: false, puedeAprobar: false, puedeBorrar: false,
    });
  });

  it('client_approver aprueba o pide cambios, pero no edita el plan', () => {
    expect(permisosSociales('client_approver')).toEqual({
      puedeLeer: true, puedeEditar: false, puedeAprobar: true, puedeBorrar: false,
    });
  });

  it('owner aprueba y edita (el admin llega como owner vía esSuperAdmin)', () => {
    expect(permisosSociales('owner')).toEqual({
      puedeLeer: true, puedeEditar: true, puedeAprobar: true, puedeBorrar: false,
    });
  });

  it('todo el equipo edita, ordena y programa; ninguno aprueba por el cliente', () => {
    const equipo = ['creator', 'camera', 'model', 'editor', 'publisher', 'media_buyer'] as const;
    for (const rol of equipo) {
      expect(permisosSociales(rol), rol).toEqual({
        puedeLeer: true, puedeEditar: true, puedeAprobar: false, puedeBorrar: false,
      });
    }
    // Y el equipo coincide exactamente con PUEDE_EDITAR de flow.ts: dos listas
    // distintas de «quién escribe» es el fallo que este repo ya pagó dos veces.
    expect(equipo.slice().sort()).toEqual(ROLE_KEYS.filter((rol) => rol !== 'owner' && rol !== 'client_approver' && rol !== 'client_viewer').sort());
  });

  it('sin_rol (sesión sin fila en ESTE proyecto) no abre nada: ni siquiera leer', () => {
    // NX-1030 H1: antes `sin_rol` heredaba lectura y cualquier cookie válida
    // de un cliente leía el plan y el historial de otro. Lo que sí se permite
    // leer sin fila es el camino SIN TABLA (demo), y eso ya no vive en el rol:
    // vive en `veredicto.via`, resuelto por `permisosSocialesDeVeredicto`.
    expect(permisosSociales('sin_rol')).toEqual({
      puedeLeer: false, puedeEditar: false, puedeAprobar: false, puedeBorrar: false,
    });
    expect(esRolSocialConocido('sin_rol')).toBe(false);
  });

  it('un valor desconocido que venga de la base no abre nada (lista positiva)', () => {
    expect(permisosSociales('director_de_fotografia' as never)).toEqual({
      puedeLeer: false, puedeEditar: false, puedeAprobar: false, puedeBorrar: false,
    });
  });

  it('nadie puede borrar de forma irreversible: puedeBorrar es false sin excepción', () => {
    for (const rol of [...ROLE_KEYS, 'visitante', 'sin_rol', null, undefined, 'inventado'] as const) {
      expect(permisosSociales(rol).puedeBorrar, String(rol)).toBe(false);
    }
    expect(MOTIVO_SIN_PERMISO.borrar).toContain('archivando');
  });
});

describe('permisosSocialesDeVeredicto — SIN TABLA contra SIN FILA', () => {
  const soloLectura = { puedeLeer: true, puedeEditar: false, puedeAprobar: false, puedeBorrar: false };

  it('SIN TABLA (demo, sin datos): el lector sin fila sigue leyendo', () => {
    expect(permisosSocialesDeVeredicto({ rol: 'sin_rol', via: 'sin-tabla' })).toEqual(soloLectura);
  });

  it('SIN TABLA con el dueño de la demo: el recorrido de edición sigue entero', () => {
    expect(permisosSocialesDeVeredicto({ rol: 'owner', via: 'sin-tabla' })).toEqual({
      puedeLeer: true, puedeEditar: true, puedeAprobar: true, puedeBorrar: false,
    });
  });

  it('SIN FILA con tabla presente: la cookie de OTRO cliente no lee ni una fila', () => {
    // El hueco de H1, medido al revés: mismo rol `sin_rol`, y lo que cambia es
    // `via`. Con tabla, `session` + sin fila es un miembro inexistente en este
    // proyecto → 403, sin excepción.
    expect(permisosSocialesDeVeredicto({ rol: 'sin_rol', via: 'session' })).toEqual(SIN_ACCESO);
    expect(permisosSocialesDeVeredicto({ rol: 'sin_rol', via: 'session' }).puedeLeer).toBe(false);
  });

  it('con fila en ESTE proyecto manda la matriz, no la procedencia', () => {
    expect(permisosSocialesDeVeredicto({ rol: 'client_viewer', via: 'session' })).toEqual(soloLectura);
    expect(permisosSocialesDeVeredicto({ rol: 'client_approver', via: 'session' })).toEqual({
      puedeLeer: true, puedeEditar: false, puedeAprobar: true, puedeBorrar: false,
    });
    expect(permisosSocialesDeVeredicto({ rol: 'creator', via: 'session' })).toEqual({
      puedeLeer: true, puedeEditar: true, puedeAprobar: false, puedeBorrar: false,
    });
  });

  it('sin sesión no se concede nada, aunque el guard degrade a client_viewer', () => {
    expect(permisosSocialesDeVeredicto({ rol: 'client_viewer', via: 'sin-sesion' })).toEqual(SIN_ACCESO);
  });

  it('sin proyecto conocido no se concede nada', () => {
    expect(permisosSocialesDeVeredicto(null)).toEqual(SIN_ACCESO);
  });

  it('ningún veredicto habilita el borrado irreversible', () => {
    for (const veredicto of [
      null,
      { rol: 'sin_rol', via: 'sin-tabla' },
      { rol: 'sin_rol', via: 'session' },
      { rol: 'owner', via: 'session' },
      { rol: 'client_viewer', via: 'sin-sesion' },
    ] as const) {
      expect(permisosSocialesDeVeredicto(veredicto).puedeBorrar, JSON.stringify(veredicto)).toBe(false);
    }
  });
});

describe('soloCambioDeAprobacion', () => {
  const plan = (posts: SocialPost[]) => ({ posts, pautas: [post({ id: 'pauta-01', slot: 1 })] });

  it('cambiar el estado de una pieza SÍ es aprobación', () => {
    const antes = plan([post()]);
    const despues = plan([post({ estado: 'aprobado' })]);
    expect(soloCambioDeAprobacion(antes, despues)).toBe(true);
  });

  it('dejar el comentario del cambio SÍ es aprobación', () => {
    const antes = plan([post({ estado: 'cambios', feedbackCambio: 'Portada más cercana.' })]);
    const despues = plan([post({ estado: 'pendiente', feedbackCambio: '' })]);
    expect(soloCambioDeAprobacion(antes, despues)).toBe(true);
  });

  it('reescribir la descripción NO es aprobación', () => {
    const antes = plan([post()]);
    const despues = plan([post({ caption: 'Texto reescrito por el cliente.' })]);
    expect(soloCambioDeAprobacion(antes, despues)).toBe(false);
  });

  it('cambiar la portada, la fecha o los hashtags NO es aprobación', () => {
    const antes = plan([post()]);
    for (const cambio of [
      { portadaUrl: '/otra.svg' },
      { fechaSugerida: 'Viernes 6:00 p. m.' },
      { hashtags: ['otro'] },
      { mediaUrl: 'https://drive.google.com/d/xyz' },
      { tipo: 'carrusel' as const },
    ]) {
      expect(soloCambioDeAprobacion(antes, plan([post(cambio)])), JSON.stringify(cambio)).toBe(false);
    }
  });

  it('reordenar, añadir o quitar piezas NO es aprobación', () => {
    const dos = [post({ id: 'a', slot: 1 }), post({ id: 'b', slot: 2 })];
    const dosAlReves = [post({ id: 'b', slot: 1 }), post({ id: 'a', slot: 2 })];
    expect(soloCambioDeAprobacion(plan(dos), plan(dosAlReves))).toBe(false);
    expect(soloCambioDeAprobacion(plan(dos), plan([dos[0]]))).toBe(false);
    expect(soloCambioDeAprobacion(plan([post()]), plan([...dos]))).toBe(false);
  });

  it('toca las DOS colecciones: un aprobador no mete mano en la pauta', () => {
    const antes = plan([post()]);
    const despues = {
      posts: [post({ estado: 'aprobado' })],
      pautas: [post({ id: 'pauta-01', slot: 1, caption: 'Pauta reescrita.' })],
    };
    expect(soloCambioDeAprobacion(antes, despues)).toBe(false);
  });
});
