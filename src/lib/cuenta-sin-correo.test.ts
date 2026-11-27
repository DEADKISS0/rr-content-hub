import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(new URL('../app/api/cuenta/route.ts', import.meta.url), 'utf8');
const ruta = fuente
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('el alta no manda correo', () => {
  it('confirma el correo en el acto y no invita ni manda OTP', () => {
    expect(ruta).toMatch(/email_confirm:\s*true/);
    expect(ruta).not.toMatch(/inviteUserByEmail|signInWithOtp|resetPasswordForEmail|signInWithOAuth/);
  });

  it('el invitado no recibe fila de acceso y el registro sí, como editor', () => {
    expect(ruta).toMatch(/role_in_project: 'editor'/);
    expect(ruta).toMatch(/modo === 'registro'/);
    expect(ruta).not.toMatch(/is_team_member:\s*true/);
  });
});
