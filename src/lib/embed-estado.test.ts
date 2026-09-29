import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-09-29: "no se entiende si tiene previsualización o no, a
 * pesar de que sí la tenga".
 *
 * Un iframe no distingue "cargó el post" de "cargó la página de error de Meta":
 * las dos son un rectángulo del mismo tamaño. Y el `load` dispara en ambos
 * casos, así que un indicador que escuche `load` miente — fue exactamente lo
 * que pasó. Este archivo fija que el estado se decide con la señal de Meta y
 * que los cuatro estados existen, incluido el de "tardando": Instagram tarda
 * hasta 10 s en pintar, y un aviso de fallo a los 3 s sería falso.
 */
const embed = readFileSync(new URL('../components/reference-embed.tsx', import.meta.url), 'utf8');
const bloque = readFileSync(new URL('../components/reference-with-brief.tsx', import.meta.url), 'utf8');

describe('el embed declara su estado', () => {
  it('tiene cuatro estados, no un sí/no', () => {
    // 'cargando' y 'tardando' son distintos a propósito: entre 1,5 s y 12 s no se
    // sabe, y pintar "no carga" en ese tramo es afirmar algo que no sabemos.
    expect(embed).toMatch(/type EstadoEmbed = 'cargando' \| 'vivo' \| 'tardando' \| 'sin-senal'/);
  });

  it('decide con el postMessage de la plataforma, no con el load', () => {
    // `load` dispara también cuando lo que llegó fue un error. La señal honesta
    // es `onRender`/`embedResize`, que Meta manda con el post ya pintado.
    expect(embed).toMatch(/addEventListener\('message', alMensaje\)/);
    expect(embed).toMatch(/SENALES_DE_PLATAFORMA = new Set/);
    expect(embed).toMatch(/'onRender'/);
    expect(embed).toMatch(/'embedResize'/);
  });

  it('espera a que la plataforma termine de pintar antes de declarar fallo', () => {
    // Medido: O1 a los 5 s tenía 0,0 % de color y a los 10 s tenía 22,2 %.
    // Con un corte antes de 10 s, un embed sano se anuncia como roto.
    expect(embed).toMatch(/const MS_ULTIMO_INTENTO = 12_000/);
    expect(embed).toMatch(/const MS_PINTADO = 1_500/);
  });

  it('expone el estado en el DOM para poder verificarlo', () => {
    // `data-estado` es lo que permite comprobar en producción si la previsualización
    // está viva, en vez de suponerlo por el ancho del iframe.
    expect(embed).toMatch(/data-estado=\{estado\}/);
    expect(embed).toMatch(/data-aviso-embed=\{estado\}/);
  });

  it('el aviso distingue el fallo con color y no lo esconde', () => {
    expect(embed).toMatch(/⚠/);
    expect(embed).toMatch(/text-mostaza/);
  });

  it('NO画出 ningún mensaje encima del post ya pintado', () => {
    // Si el aviso aparece con el embed vivo, tapa el contenido y además dice
    // "cargando" sobre algo que ya cargó.
    expect(embed).toMatch(/\{estado !== 'vivo' &&/);
  });

  it('ignora postMessages que no son de la plataforma', () => {
    // Cualquier iframe de la página (o un script suelto) puede mandar un
    // `postMessage` con `{type:'onRender'}` y fingir que el embed vive.
    expect(embed).toMatch(/evento\.origin\.includes\('instagram\.com'\)/);
    expect(embed).toMatch(/evento\.origin\.includes\('facebook\.com'\)\)\s*return/);
  });
});

describe('la ficha siempre da una salida al post', () => {
  it('el bloque usa el componente con estado, no un iframe crudo', () => {
    expect(bloque).toMatch(/<ReferenceEmbed\b/);
    // El iframe directo sin estado es el que dejó todo esto indistinguible.
    expect(bloque).not.toMatch(/<iframe\s+title=\{`Referencia visual/);
  });

  it('deja el enlace al post original junto al embed', () => {
    // Con el embed sin señal, el enlace es la única manera de llegar al post.
    // Sin él, quien ve "no pintó" se queda sin salida.
    expect(bloque).toMatch(/ABRIR EL POST EN/);
    expect(bloque).toMatch(/\{source && <Link/);
  });

  it('le pasa la plataforma para que el aviso la nombre', () => {
    expect(bloque).toMatch(/plataforma=\{platform\(url\)\}/);
  });

  it('mantiene el enlace de la cabecera', () => {
    expect(bloque).toMatch(/ABRIR ORIGINAL/);
  });
});
