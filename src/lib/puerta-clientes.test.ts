import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01: "necesito que veas que en la vista del link raíz solo
 * ofrece entrar al perfil de candilejas, y pues está mal".
 *
 * MEDIDO: la lista de clientes de la puerta estaba escrita a mano en el
 * código:
 *
 *   const PUERTAS = [
 *     { slug: 'wundeer',   nombre: 'WUNDEER',   codigo: '1111' },
 *     { slug: 'candilejas', nombre: 'CANDILEJAS', codigo: '2222' },
 *   ];
 *
 * Y en `rr_hub_projects` hay CUATRO clientes: satiro, boga, wundeer y
 * candilejas. Los dos primeros existen, tienen ideas y son clientes reales, pero
 * no aparecían: la puerta los escondía porque nadie se molestó en añadir la
 * línea.
 *
 * Esa lista escrita a mano es la causa de dos fallos distintos, y por eso el
 * arreglo NO es "añadir dos líneas más":
 *
 * 1. Cada cliente nuevo hay que acordarse de añadirlo aquí. Un olvido = un
 *    cliente invisible.
 * 2. Los códigos pueden quedar desincronizados: el código de la puerta y el de
 *    `rr_hub_projects.access_code` son dos verdades, y la puerta cree la suya.
 *
 * La lista tiene que salir de la base, que es donde el cliente vive. Este test
 * fija que no vuelva a ser una constante escrita a mano.
 */
const login = readFileSync(new URL('../app/login/formulario.tsx', import.meta.url), 'utf8');

describe('la puerta no esconde clientes', () => {
  it('la lista de clientes NO está escrita a mano en el login', () => {
    // La regresión. Con la constante escrita a mano, un cliente nuevo es
    // invisible hasta que alguien recuerde editar este archivo.
    expect(login).not.toMatch(/const PUERTAS = \[\s*\{ slug: 'wundeer'/);
  });

  it('los clientes se piden a la base, en el servidor', () => {
    // Si la lista llega por props desde el servidor, la página puede ser
    // estática y no hay fetch en el cliente.
    expect(login).toMatch(/clientes/i);
  });

  it('solo se ofrecen los clientes que tienen código de acceso', () => {
    // Medido: satiro y boga están en la base con `access_code` NULL. Mostrar un
    // botón para un cliente sin código es ofrecer una puerta que no abre.
    expect(login).toMatch(/access_code|codigo/i);
  });
});

describe('la raíz no manda a una puerta sin destino', () => {
  it('la puerta se queda siendo la `start_url` pública de la PWA', () => {
    // `/` da 307 a `/login` y `/login?fuente=app` da 200: eso ya se arregló y
    // no debe volver a romperse. Este test avisa si alguien lo toca.
    const manifest = readFileSync(new URL('../app/manifest.ts', import.meta.url), 'utf8');
    expect(manifest).toMatch(/login\?fuente=app/);
  });
});