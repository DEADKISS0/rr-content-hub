import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: auditoría general del Hub.
 *
 * HALLAZGO encadenado. La pantalla de `publicaciones` decía, y cito textual:
 *
 *   "Lo que todavía no se puede registrar es la fecha de salida y el enlace de
 *    publicación (columnas due_at y published_url): están escritas en la
 *    migración v3 y esa migración NO está aplicada en la base."
 *
 * Dos cosas MEDIDAS en `information_schema.columns` el 2026-10-01:
 *
 * 1. Las columnas EXISTEN y funcionan. `due_at timestamp with time zone`,
 *    `published_url text`. La nota era mentira.
 *
 * 2. Peor: el endpoint que edita una idea (acción `update`) no aceptaba esos dos
 *    campos. Aunque la columna estuviera, no había forma de escribirla desde el
 *    Hub. Así que la pantalla decía la verdad por el motivo equivocado: no era
 *    que faltara la migración, era que nadie había conectado el campo.
 *
 * Corregir solo el texto habría sido tapar el síntoma: la fecha seguiría sin
 * poder registrarse. Estas pruebas fijan las DOS cosas.
 */
const ruta = readFileSync(new URL('../app/api/workspace/[action]/route.ts', import.meta.url), 'utf8');
const cliente = readFileSync(new URL('../lib/workspace-client.ts', import.meta.url), 'utf8');
const publica = readFileSync(new URL('../app/[projectSlug]/publicaciones/page.tsx', import.meta.url), 'utf8');

describe('la fecha y el enlace de salida se pueden registrar', () => {
  it('la acción update acepta dueAt', () => {
    // Sin esto no hay forma de poner fecha desde el Hub, diga lo que diga la
    // pantalla.
    expect(ruta).toMatch(/dueAt/);
    expect(ruta).toMatch(/due_at/);
  });

  it('la acción update acepta publishedUrl', () => {
    expect(ruta).toMatch(/publishedUrl/);
    expect(ruta).toMatch(/published_url/);
  });

  it('el cliente puede enviarlos', () => {
    expect(cliente).toMatch(/dueAt/);
    expect(cliente).toMatch(/publishedUrl/);
  });

  it('la fecha se valida como fecha, no como texto libre', () => {
    // Una fecha invalida en `due_at` revienta la consulta entera y con ella la
    // actualización de todos los demás campos del formulario. Se valida antes.
    expect(ruta).toMatch(/Number\.isNaN|isNaN/);
  });
});

describe('publicaciones no promete lo que no hace ni lo que sí', () => {
  it('deja de decir que la migración no está aplicada', () => {
    expect(publica).not.toMatch(/NO está aplicada/i);
  });

  it('explica cómo se registra la fecha', () => {
    expect(publica).toMatch(/due_at|published_url/i);
  });
});