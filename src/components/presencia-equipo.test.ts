import { describe, expect, it } from 'vitest';

import { estadoDe, type Presencia } from '@/components/presencia-equipo';

/**
 * Los tres estados de presencia, que es lo que Dirección pidió distinguir:
 * nunca ha entrado / estuvo pero no está aquí / está en línea.
 *
 * La confusion entre "nunca ha entrado" y "estuvo pero no está" no es un
 * detalle de UI: cambia la acción. Con "nunca" hay que perseguir a alguien;
 * con "activo" solo hay que esperar. Si estas funciones se rompen, el equipo
 * escribe a quien ya se fue y no a quien sigue ahí.
 */

const AHORA = Date.parse('2026-09-28T15:00:00.000Z');
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

const persona = (lastSeenAt: string | null): Presencia => ({
  email: 'alguien@rraliados.co',
  nombre: 'Alguien',
  lastSeenAt,
});

describe('estadoDe', () => {
  it('sin latido nunca es "conectado": sale desconectado', () => {
    expect(estadoDe(persona(null), AHORA)).toBe('desconectado');
  });

  it('dentro de la ventana de 5 minutos está conectado', () => {
    expect(estadoDe(persona(hace(0)), AHORA)).toBe('conectado');
    expect(estadoDe(persona(hace(60_000)), AHORA)).toBe('conectado');
    expect(estadoDe(persona(hace(4 * 60_000)), AHORA)).toBe('conectado');
  });

  it('justo pasado el límite deja de estar conectado', () => {
    // El borde importa: 5 min exactos entra, un milisegundo más no. Un
    // `>=` mal puesto deja gente "conectada" medio minuto de más.
    expect(estadoDe(persona(hace(5 * 60_000)), AHORA)).toBe('conectado');
    expect(estadoDe(persona(hace(5 * 60_000 + 1)), AHORA)).toBe('activo');
  });

  it('pasada la ventana está activo, no desconectado', () => {
    // La distinción que importa: estuvo y se fue, o nunca ha entrado.
    expect(estadoDe(persona(hace(10 * 60_000)), AHORA)).toBe('activo');
    expect(estadoDe(persona(hace(3 * 24 * 3_600_000)), AHORA)).toBe('activo');
  });

  it('una fecha corrupta no dice "conectado"', () => {
    // El peor fallo posible: un `NaN` que comparado con `<=` da false en
    // cualquier lado, pero si la comparación se invierte,aría dar "en línea".
    expect(estadoDe(persona('no-es-una-fecha'), AHORA)).toBe('desconectado');
    expect(estadoDe(persona(''), AHORA)).toBe('desconectado');
  });
});
