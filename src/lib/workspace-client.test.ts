import { describe, expect, it } from 'vitest';
import { buildIdeaPack } from './workspace-client';

/**
 * El brief automático es lo que lee el equipo antes de rodar. Antes de esta
 * ronda (2026-09-27) escribía lo mismo para cualquier referencia: un reel de
 * Instagram, un post de Drive y un TikTok recibían literalmente la misma
 * instrucción de cámara. Estas pruebas fijan que la referencia cambia el
 * consejo, y que el texto no inventa datos que no tiene.
 */
const base = { title: 'Macro: textura que se siente', objective: 'Que se sienta la tela', description: 'Plano detalle' };

describe('buildIdeaPack', () => {
  it('el guion siempre lleva título, objetivo y referencia', () => {
    const pack = buildIdeaPack({ ...base, reference: 'https://www.instagram.com/reel/DcN2tugtTc-/' });
    expect(pack.script).toContain('Macro: textura que se siente');
    expect(pack.script).toContain('Que se sienta la tela');
    expect(pack.script).toContain('https://www.instagram.com/reel/DcN2tugtTc-/');
  });

  it('un reelVertical no recibe las mismas indicaciones que un post de Drive', () => {
    const reel = buildIdeaPack({ ...base, reference: 'https://www.instagram.com/reel/DcN2tugtTc-/' });
    const drive = buildIdeaPack({ ...base, reference: 'https://drive.google.com/file/d/abc123/view' });
    expect(reel.camera).not.toBe(drive.camera);
    expect(reel.edit).not.toBe(drive.edit);
  });

  it('un reel dice vertical y un post de Drive no', () => {
    const reel = buildIdeaPack({ ...base, reference: 'https://www.instagram.com/reel/DcN2tugtTc-/' });
    expect(reel.camera).toMatch(/vertical/i);
    const drive = buildIdeaPack({ ...base, reference: 'https://drive.google.com/file/d/abc123/view' });
    expect(drive.camera).not.toMatch(/vertical/i);
  });

  it('el guion explica de qué es la referencia, no solo la repite', () => {
    const pack = buildIdeaPack({ ...base, reference: 'https://www.instagram.com/reel/DcN2tugtTc-/' });
    expect(pack.script).toMatch(/QUÉ ESTAMOS COPIANDO DE LA REFERENCIA/);
    expect(pack.script).toMatch(/Reel vertical/);
  });

  it('una referencia desconocida no inventa: lo dice y pide abrirla', () => {
    const pack = buildIdeaPack({ ...base, reference: 'https://ejemplo.com/cosas' });
    expect(pack.script).toMatch(/ábrela antes de rodar/i);
  });

  it('sin referencia, el guion avisa que falta', () => {
    const pack = buildIdeaPack({ ...base, reference: '' });
    expect(pack.script).toContain('Pendiente de enlace visual');
  });

  it('los tres campos del brief nunca salen vacíos', () => {
    const pack = buildIdeaPack({ title: '', objective: '', description: '', reference: '' });
    for (const campo of [pack.camera, pack.talent, pack.edit, pack.script]) {
      expect(campo.trim().length).toBeGreaterThan(20);
    }
  });
});
