import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: auditoría general del Hub.
 *
 * HALLAZGO: dos pantallas le Dijeron al usuario algo FALSO.
 *
 *   metricas/page.tsx    "…llegarán cuando se aplique la migración v3
 *                        (columnas metrics, published_url y due_at), que hoy
 *                        NO está aplicada."
 *
 *   publicaciones/page.tsx  "…(columnas due_at y published_url): están escritas
 *                        en la migración v3 y esa migración NO está aplicada."
 *
 * MEDIDO en `information_schema.columns` el 2026-10-01: las cuatro columnas
 * existen y son utilizables.
 *
 *   cover_asset_id  uuid
 *   due_at          timestamp with time zone
 *   metrics         jsonb
 *   published_url   text
 *
 * El efecto de esa nota era peor que la falta de funcionalidad: la pantalla
 * dice que la fecha "no se puede registrar", así que nadie la registra, y la
 * columna sigue vacía. Es una mentira que se sostiene sola. Por eso el test
 * prohíbe el texto, y no la ausencia de la funcionalidad: si mañana la columna
 * se cae, lo que hay que avisar es otra cosa.
 */
const metricas = readFileSync(new URL('../app/[projectSlug]/metricas/page.tsx', import.meta.url), 'utf8');
const publicaciones = readFileSync(new URL('../app/[projectSlug]/publicaciones/page.tsx', import.meta.url), 'utf8');

/** La afirmación que se mids en la base y era falsa. */
const AFIRMACION_FALSA = /NO está aplicada|NO esta aplicada|no está aplicada/i;

describe('ninguna pantalla miente sobre el estado de la base', () => {
  it('métricas no afirma que la migración v3 esté sin aplicar', () => {
    expect(metricas).not.toMatch(AFIRMACION_FALSA);
  });

  it('publicaciones no afirma que la migración v3 esté sin aplicar', () => {
    expect(publicaciones).not.toMatch(AFIRMACION_FALSA);
  });

  it('la nota vieja no vuelve en ninguna forma', () => {
    // La otra forma del mismo texto: "no está aplicada" en cualquier
    // variante. Las dos pantallas tienen que quedar limpias.
    for (const t of [metricas, publicaciones]) {
      expect(t).not.toMatch(/migración v3.*(NO|pendiente|falta)/i);
    }
  });
});

describe('las columnas que existen se usan de verdad', () => {
  it('métricas lee las piezas publicadas', () => {
    // La pantalla que dice "no se puede" tiene que estar midiendo algo.
    expect(metricas).toMatch(/published_url|metrics/i);
  });

  it('publicaciones trabaja con la fecha de salida', () => {
    // `due_at` es lo que convierte una cola en un plan. Sin esto, la pantalla
    // solo lista.
    expect(publicaciones).toMatch(/due_at/i);
  });
});