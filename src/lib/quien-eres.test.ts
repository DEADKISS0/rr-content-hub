import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

describe('quién eres al elegir un cliente', () => {
  it('el cascarón pide el nombre al entrar al cliente, no al crear la idea', () => {
    const shell = leer('src/components/workspace-shell.tsx');
    expect(shell).toContain('QuienEres');
    expect(shell).toMatch(/abierto=\{sesion\.listo && !sesion\.correo\}/);

    const form = leer('src/components/new-idea-form.tsx');
    expect(form).not.toContain('QuienEres');
    expect(form).not.toContain('EntradaInvitadoIdea');
    expect(form).not.toContain('/api/identidad');
  });

  it('el diálogo ofrece la lista y la opción de entrar como invitado', () => {
    const dialogo = leer('src/components/quien-eres.tsx');
    expect(dialogo).toMatch(/¿Quién eres\?/);
    expect(dialogo).toMatch(/ENTRAR COMO INVITADO/);
    expect(dialogo).toMatch(/nombre-invitado/);
    expect(dialogo).not.toMatch(/access_code|código de tu cliente|signInWith/i);
  });
});
