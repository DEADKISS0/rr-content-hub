import { describe, it, expect } from 'vitest';
import { destinoTrasEntrar } from './destino-login';

/**
 * Santiago, 2026-10-01: "ambos links me mandan a 404".
 *
 * Estos casos son los MEDIDOS, no inventados: cada uno sale de una URL que se
 * pidió de verdad o de un fallo que se quiere que no vuelva.
 */
describe('el destino después de entrar', () => {
  it('devuelve a la idea si el link venía de una idea', () => {
    // El caso que reportó Santiago: abrió el link de P29, entró, y quedó en el tablero.
    expect(destinoTrasEntrar('/wundeer/ideas/c3d19138-410c-4a32-9f58-3e641f25d653', 'wundeer')).toBe(
      '/wundeer/ideas/c3d19138-410c-4a32-9f58-3e641f25d653',
    );
  });

  it('sin next, aterriza en la portada del cliente', () => {
    expect(destinoTrasEntrar(null, 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar(undefined, 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar('', 'wundeer')).toBe('/wundeer');
  });

  it('descarta el redirect abierto: un next externo es phishing', () => {
    // Si esto pasara, nuestra puerta mandaría al visitante a donde le manden.
    expect(destinoTrasEntrar('https://sitio-malicioso.example/robo', 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar('//sitio-malicioso.example', 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar('javascript:alert(1)', 'wundeer')).toBe('/wundeer');
  });

  it('no vuelve al propio login: eso es un bucle', () => {
    expect(destinoTrasEntrar('/login', 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar('/login?next=/login', 'wundeer')).toBe('/wundeer');
  });

  it('una idea de otro cliente NO se respeta', () => {
    // Entrar por Wundeer y abrir una ruta de Candilejas es el 404 exacto que
    // se reportó: la idea no existe en este cliente.
    expect(destinoTrasEntrar('/candilejas/ideas/abc', 'wundeer')).toBe('/wundeer');
  });

  it('acepta otras rutas del mismo cliente', () => {
    expect(destinoTrasEntrar('/wundeer', 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar('/wundeer/ideas', 'wundeer')).toBe('/wundeer/ideas');
    expect(destinoTrasEntrar('/wundeer/produccion', 'wundeer')).toBe('/wundeer/produccion');
  });

  it('limpia la query y el hash sin perder la ruta', () => {
    expect(destinoTrasEntrar('/wundeer/ideas/abc?tab=votos', 'wundeer')).toBe('/wundeer/ideas/abc');
    expect(destinoTrasEntrar('/wundeer/ideas/abc#votar', 'wundeer')).toBe('/wundeer/ideas/abc');
  });

  it('la raíz sola cae a la portada del cliente', () => {
    expect(destinoTrasEntrar('/', 'wundeer')).toBe('/wundeer');
    expect(destinoTrasEntrar('/', 'candilejas')).toBe('/candilejas');
  });
});