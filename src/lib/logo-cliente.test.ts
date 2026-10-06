import { describe, it, expect } from 'vitest';
import { logoDeCliente, SIN_LOGO } from './logo-cliente';

/**
 * MEDIDO 2026-10-05: la cabecera pedía el logo de Wundeer en vez del nombre en
 * texto. El bucket `rr-content-assets` no acepta SVG (HTTP 415), así que el
 * archivo es un PNG en `public/logos/`.
 */
describe('logoDeCliente', () => {
  it('devuelve la ruta del logo cuando el cliente tiene', () => {
    expect(logoDeCliente('wundeer')).toBe('/logos/wundeer.png');
  });

  it('devuelve null, no una ruta inventada, cuando el cliente no tiene logo', () => {
    // Un slug desconocido NO debe devolver una ruta: el navegador mostraría el
    // ícono de imagen rota en la barra, que es peor que no mostrar nada.
    expect(logoDeCliente('candilejas')).toBeNull();
    expect(logoDeCliente('cliente-que-no-existe')).toBeNull();
    expect(logoDeCliente('')).toBeNull();
  });

  it('deja claro que un cliente sin logo es una decisión y no un olvido', () => {
    expect(SIN_LOGO).toContain('candilejas');
  });
});