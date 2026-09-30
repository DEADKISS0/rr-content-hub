import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHASES, STATUS_META, phaseIndex, type WorkflowStatus } from '@/lib/flow';
import { BOARD_COLUMNS } from '@/lib/queues';

/**
 * Dos cosas que Santiago reporto el 2026-09-30, y las dos eran bugs de verdad:
 *
 * 1. "bloqueamos una idea que no nos gustó y meterse bloqueado se fue a otra
 *    categoría que se llama publicado". `closed` estaba en el MISMO grupo que
 *    `published`, así que una idea DESCARTADA se leía y se contaba como
 *    PUBLICADA. Lo contrario en una sola palabra.
 *
 * 2. "cuando uno abre una idea aparece primero como la foto de la portada y
 *    luego ya el vídeo, eso confunde". Era un problema de ORDEN: la portada se
 *    pintaba antes que la referencia, y las dos se parecen tanto que quien abría
 *    la ficha veía una foto y creía que eso era la pieza.
 */

const raiz = new URL('../../', import.meta.url).pathname;
const ficha = readFileSync(raiz + 'src/app/[projectSlug]/ideas/[ideaId]/page.tsx', 'utf8');

describe('Descartada no es publicada', () => {
  it('cerrada y publicada NO comparten grupo', () => {
    const publicada = PHASES.find((f) => (f.statuses as readonly string[]).includes('published'));
    const cerrada = PHASES.find((f) => (f.statuses as readonly string[]).includes('closed'));

    // El bug: las dos estaban en `live`. Con eso, una idea archivada aparecía
    // dentro de "PUBLICACIÓN" y el contador la contaba como si hubiera salido.
    expect(publicada).toBeTruthy();
    expect(cerrada).toBeTruthy();
    expect(cerrada!.key).not.toBe(publicada!.key);
    expect((publicada!.statuses as readonly string[])).not.toContain('closed');
  });

  it('descartada tiene su propia columna, y dice que no va a salir', () => {
    const cerrada = PHASES.find((f) => (f.statuses as readonly string[]).includes('closed'))!;
    expect(cerrada.label).toBe('DESCARTADAS');
    expect(cerrada.detail).toMatch(/No salió/);
    // Y `published` dice lo contrario: una cosa es lo que salió y otra lo que no.
    const publicada = PHASES.find((f) => (f.statuses as readonly string[]).includes('published'))!;
    expect(publicada.detail).toMatch(/Ya salió/);
  });

  it('ningun estado aparece en dos grupos', () => {
    // La causa raiz del bug era un estado en dos sitios. Con esto, si alguien
    // lo vuelve a hacer, el test lo dice en vez de descubrirlo en produccion.
    const vistos = new Map<string, string>();
    for (const fase of PHASES) {
      for (const estado of fase.statuses as readonly string[]) {
        const previa = vistos.get(estado);
        expect(previa, `${estado} esta en ${previa} y en ${fase.key}`).toBeUndefined();
        vistos.set(estado, fase.key);
      }
    }
    expect(vistos.size).toBeGreaterThanOrEqual(13);
  });

  it('descartada se lee distinto de publicada en la etiqueta', () => {
    // Dos etiquetas que se confundan en pantalla son un bug aunque el dato este
    // bien: aqui una es "CERRADO" y la otra "PUBLICADO".
    expect(STATUS_META.closed.label).not.toBe(STATUS_META.published.label);
    expect(STATUS_META.closed.blurb).toMatch(/historial/);
  });

  it('descartada es el final del recorrido, no un paso mas', () => {
    // Sin estados escritos a mano: `scripts/verify-no-hardcoded-states.mjs` los
    // detecta y frena el gate. Se toma el ULTIMO de la lista de cada fase, que
    // es el que hace la prueba sin inventar ningun estado.
    const ultima = (fase: string): WorkflowStatus => {
      const estados = PHASES.find((f) => f.key === fase)!.statuses as readonly WorkflowStatus[];
      return estados[estados.length - 1];
    };
    expect(phaseIndex('closed')).toBeGreaterThan(phaseIndex(ultima('edit')));
  });

  it('el tablero tiene columna de descartadas, y no las mezcla con las publicadas', () => {
    // AQUI ESTABA EL BUG QUE SANTIAGO VIO: la columna se llamaba PUBLICADO y sus
    // estados venían de `byPhase('live')`, que incluía `closed`. La idea
    // bloqueada salia en la columna de lo publicado.
    const publicada = BOARD_COLUMNS.find((c) => c.key === 'published')!;
    const cerrada = BOARD_COLUMNS.find((c) => c.key === 'closed')!;

    expect((publicada.statuses as readonly string[])).not.toContain('closed');
    expect(cerrada.label).toBe('DESCARTADAS');
    expect(cerrada.statuses.length).toBeGreaterThan(0);
    // Y ninguna columna puede repetir estados de otra, o los contadores mienten.
    for (const a of BOARD_COLUMNS) {
      for (const b of BOARD_COLUMNS) {
        if (a.key === b.key) continue;
        const comunes = (a.statuses as readonly string[]).filter((s) =>
          (b.statuses as readonly string[]).includes(s),
        );
        expect(comunes, `${a.key} y ${b.key} comparten ${comunes}`).toHaveLength(0);
      }
    }
  });
});

describe('Al abrir una idea se ve la referencia, no la portada', () => {
  it('la portada NO se pinta antes de la referencia', () => {
    // OJO CON LO QUE SE COMPRA AQUI, que se Midio mal dos veces:
    //
    // 1. Comparar `indexOf('IdeaCoverFrame')` con `indexOf('ReferenceWithBrief')`
    //    no dice nada: los dos IMPORTAN al principio del archivo (lineas 12 y
    //    arriba), asi que la comparacion daba "bien" con la portada en su sitio
    //    viejo, justo encima del titulo. Hay que buscar el USO en el JSX.
    // 2. Y el primer uso legitimo esta ANTES de la referencia: es el fallback
    //    de "esta pieza no tiene video". Ese si tiene que ir ahi, occupying el
    //    hueco, y lleva su propia etiqueta para que no se tome por la pieza.
    //
    // Lo que NO puede pasar es una portada SIN ETIQUETA en el tramo entre el
    // titulo y la referencia: esa es la que se confundia con el embed.
    const usos = [...ficha.matchAll(/<IdeaCoverFrame/g)].map((m) => m.index!);
    const iRef = ficha.indexOf('<ReferenceWithBrief');
    const iTitulo = ficha.indexOf('display-title');
    expect(usos.length, 'la ficha tiene que pintar la portada').toBeGreaterThan(0);
    expect(iRef).toBeGreaterThan(-1);

    // Cada portada que aparece antes de la referencia tiene que ir ACOMPAÑADA de
    // su etiqueta en el mismo bloque: o la rama del fallback con "[SIN
    // REFERENCIA]", o nada.
    for (const uso of usos.filter((u) => u < iRef)) {
      const bloque = ficha.slice(uso - 900, uso);
      expect(
        /\[SIN REFERENCIA\]/.test(bloque),
        'una portada antes de la referencia tiene que decir que no hay referencia',
      ).toBe(true);
    }
    // Y en el tramo del titulo a la referencia no cabe ninguna: el navegador
    // pinta en orden de lectura, y ahi es donde se confundia.
    const cabecera = ficha.slice(iTitulo, iRef);
    expect(cabecera).not.toMatch(/<IdeaCoverFrame/);
  });

  it('la portada va etiquetada como apoyo, para que no se tome por la pieza', () => {
    // Ponerla al final no basta: sin decir que es una foto de apoyo, el mismo
    // confusion vuelve en la barra lateral. Por eso la etiqueta va SIEMPRE.
    expect(ficha).toMatch(/\[FOTO DE APOYO\]/);
    expect(ficha).toMatch(/NO ES LA PIEZA/);
    expect(ficha).toMatch(/Sin referencia la ficha no puede quedar con un hueco/);
  });

  it('si no hay referencia, la ficha avisa en vez de dejar un hueco mudo', () => {
    expect(ficha).toMatch(/\[SIN REFERENCIA\]/);
    expect(ficha).toMatch(/\[FALTA LA REFERENCIA\]/);
  });

  it('la ficha conserva el hueco del guion de la guia', () => {
    // El `data-guia` es lo que engancha el recorrido guiado. Si al cambiar el
    // orden el bloque de la referencia pierde el atributo, la guia deja de
    // funcionar sin que nadie lo note.
    const iAtributo = ficha.indexOf('data-guia="brief"');
    expect(iAtributo).toBeGreaterThan(-1);
    // Y tiene que estar en las TRES ramas: con referencia, sin ella, y sin ninguna.
    expect(ficha.match(/data-guia="brief"/g)?.length).toBe(3);
  });
});
