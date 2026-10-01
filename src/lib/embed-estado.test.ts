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
    // es la que Meta manda cuando el post ya está pintado dentro del marco.
    expect(embed).toMatch(/addEventListener\('message', alMensaje\)/);
    expect(embed).toMatch(/SENALES_DE_PLATAFORMA = new Set/);
    expect(embed).toMatch(/'MEASURE'/);
    // `MOUNTED` llega después de `MEASURE` y también significa que está montado.
    expect(embed).toMatch(/'MOUNTED'/);
  });

  it('MEASURE es la señal real, medida; onRender es la de la documentación vieja', () => {
    // Este fue el fallo del indicador. Los `postMessage` que manda Instagram de
    // verdad, medidos el 2026-09-29 con el embed en una página limpia:
    //
    //   https://www.instagram.com :: {"details":{},"type":"LOADING"}
    //   https://www.instagram.com :: {"details":{"height":533},"type":"MEASURE"}
    //
    // `onRender` y `embedResize` no llegan NUNCA. Con solo ellos el indicador
    // caía en "no pintó" sobre siete embeds que sí estaban pintados.
    expect(embed).toMatch(/"MEASURE"/);
    expect(embed).toMatch(/el post ya está pintado/);
  });

  it('LOADING no cuenta como señal de vida', () => {
    // `LOADING` es "todavía no". Contarlo bastaría para declarar viva la
    // previsualización en el primer instante, que es justo lo que hay que evitar.
    expect(embed).toMatch(/SENALES_ROTAS = new Set\(\['LOADING'/);
    expect(embed).toMatch(/if \(SENALES_ROTAS\.has\(tipo\)\) return/);
  });

  it('el mensaje llega como STRING JSON, no como objeto', () => {
    // El fallo de raíz del indicador. Medido con un espía en la ficha real:
    //
    //   typeof event.data === "string"
    //   -> '{"details":{"height":458},"type":"MEASURE"}'
    //
    // Leer `data.type` sobre un string sale `undefined` SIEMPRE, así que el
    // indicador caía en "no pintó" aunque el `MEASURE` con su altura hubiera
    // llegado desde el primer intento. No era un problema de señal: era un
    // problema de la forma del mensaje.
    expect(embed).toMatch(/function tipoDelMensaje/);
    expect(embed).toMatch(/typeof datos === 'string'/);
    expect(embed).toMatch(/JSON\.parse\(datos\)/);
    expect(embed).toMatch(/tipoDelMensaje\(evento\.data\)/);
  });

  it('el tipo se lee con el ayudante, no con la propiedad cruda', () => {
    // La regresión, escrita SIN nombrar el patrón prohibido: un comentario que
    // lo nombre dispara su propia aserción, y el test se sabotea solo. La
    // versión anterior falló por eso y por el motivo equivocado.
    const lineasDeCodigo = embed
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'));
    const codigo = lineasDeCodigo.join('\n');
    expect(codigo).toMatch(/tipoDelMensaje\(evento\.data\)/);
    expect(codigo).not.toMatch(/evento\.data\?\./);
  });

  it('un mensaje ilegible no rompe el indicador', () => {
    // Sin flag `s` (el target del proyecto es es2017): se comprueba el `catch`
    // y el `return null` por separado, que es lo que importa.
    expect(embed).toMatch(/catch \{/);
    expect(embed).toMatch(/return null;/);
  });

  it('hay que PREGUNTARLE al embed: sin el resize no responde', () => {
    // El embed de Instagram solo contesta a un `postMessage('resize')` de la
    // página anfitriona. Un solo intento al montar se pierde, porque el embed
    // todavía no ha montado su listener. Con cero preguntas, Meta calla y no hay
    // forma de distinguir "tardando" de "roto".
    expect(embed).toMatch(/postMessage\('resize', '\*'\)/);
    expect(embed).toMatch(/setInterval\(/);
    expect(embed).toMatch(/clearInterval\(reintento\)/);
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
    // 2026-10-01: el nombre de la plataforma sale de CADA URL, no de una sola.
    // Antes era `platform(url)` porque solo se pintaba una referencia; con la
    // lista, un embed de Instagram y otro de Facebook pueden convivir y cada
    // aviso tiene que nombrar la plataforma de SU referencia.
    expect(bloque).toMatch(/plataforma=\{platform\(cadaUrl\)\}/);
  });

  it('mantiene el enlace de la cabecera', () => {
    expect(bloque).toMatch(/ABRIR ORIGINAL/);
  });
});
