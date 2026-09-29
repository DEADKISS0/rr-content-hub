import { describe, expect, it } from 'vitest';
import { SOLO_MIRA_EN_EL_VOTEO, PUEDE_COMENTAR, PUEDE_EDITAR, PUEDE_ESCRIBIR_GUION, ROLE_KEYS } from './flow';

/**
 * El equipo, la lista blanca y quién cuenta como votante.
 *
 * Lo que se fijó aquí (Santiago, 2026-09-28): todo el mundo es equipo por
 * defecto, se entra con el correo registrado, y SOLO cuentan como votantes los
 * que están en la lista blanca y con la fila activa. Estas pruebas existen para
 * que nadie reintroduzca un permiso por lista negativa.
 */
describe('el equipo y el voto', () => {
  it('mirar no es votar: el rol que solo mira queda fuera del conteo', () => {
    expect(SOLO_MIRA_EN_EL_VOTEO).toContain('client_viewer');
    // Y el comentario explica por qué no se puede escribir como lista de roles.
    expect(SOLO_MIRA_EN_EL_VOTEO).not.toContain('owner');
  });

  it('comentar es de todo el equipo, incluido quien solo mira', () => {
    // Si comentar quedara fuera de `client_viewer`, avisar un cambio sería
    // imposible justo para quien está mirando la pieza.
    expect(PUEDE_COMENTAR).toContain('client_viewer');
    expect(PUEDE_COMENTAR).toContain('client_approver');
  });

  it('las listas son de roles que existen: nada de valores inventados', () => {
    for (const lista of [PUEDE_EDITAR, PUEDE_ESCRIBIR_GUION, PUEDE_COMENTAR, SOLO_MIRA_EN_EL_VOTEO]) {
      for (const rol of lista) expect(ROLE_KEYS).toContain(rol);
    }
  });

  it('escribir el guion no es de quien aprueba ni de quien solo mira', () => {
    expect(PUEDE_ESCRIBIR_GUION).not.toContain('client_approver');
    expect(PUEDE_ESCRIBIR_GUION).not.toContain('client_viewer');
  });
});