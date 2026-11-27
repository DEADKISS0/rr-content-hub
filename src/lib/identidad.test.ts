import { describe, expect, it } from 'vitest';
import { mismoNombre, nombreValido, rolDeIdentidad, ROL_INVITADO } from './identidad';

describe('nombreValido', () => {
  it('acepta un nombre corto y recorta espacios', () => {
    expect(nombreValido('  Ana Pérez  ')).toBe('Ana Pérez');
  });

  it('rechaza vacío, una letra o un número', () => {
    expect(nombreValido('')).toBeNull();
    expect(nombreValido('A')).toBeNull();
    expect(nombreValido(12)).toBeNull();
  });

  it('rechaza un nombre de más de 80 caracteres', () => {
    expect(nombreValido('a'.repeat(81))).toBeNull();
    expect(nombreValido('a'.repeat(80))).toBe('a'.repeat(80));
  });
});

describe('mismoNombre', () => {
  it('trata mayúsculas y espacios de más como el mismo nombre', () => {
    expect(mismoNombre('Ana  Pérez', 'ana pérez')).toBe(true);
    expect(mismoNombre('Ana', 'Luis')).toBe(false);
  });
});

describe('rolDeIdentidad', () => {
  it('conserva el rol de una fila de acceso', () => {
    expect(rolDeIdentidad('client')).toBe('client');
    expect(rolDeIdentidad('producer')).toBe('producer');
  });

  it('da el rol editor de invitado cuando no hay acceso', () => {
    expect(rolDeIdentidad(null)).toBe(ROL_INVITADO);
    expect(rolDeIdentidad(undefined)).toBe(ROL_INVITADO);
    expect(rolDeIdentidad('')).toBe(ROL_INVITADO);
  });
});
