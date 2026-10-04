import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El origen de la idea (`manual` / `asistente`) no es una etiqueta suelta: es un
 * dato con tres reglas que se pueden romper en silencio.
 *
 * Santiago, 2026-09-29: "quiero que hagas una categoría para los proyectos donde
 * meteras las ideas que subas tu, para diferenciar las que se pongan manual y
 * las que tu montes".
 */

// El test vive en src/lib/, asi que la raiz del repo esta dos niveles arriba.
const raiz = new URL('../../', import.meta.url).pathname;
const leer = (ruta: string) => readFileSync(raiz + ruta, 'utf8');

const ruta = leer('src/app/api/workspace/[action]/route.ts');
const data = leer('src/lib/data.ts');
const cliente = leer('src/lib/workspace-client.ts');
const mapa = leer('src/components/project-map.tsx');
const ficha = leer('src/app/[projectSlug]/ideas/[ideaId]/page.tsx');
const componente = leer('src/components/idea-origen.tsx');
const tarjetas = leer('src/components/project-map.tsx');
const datos = leer('src/lib/data.ts');
const tabs = leer('src/components/origen-tabs.tsx');
const migracion = leer('supabase/migrations/20260929_hub_ideas_origen.sql');

describe('columna origen en la base', () => {
  it('existe con los dos valores y por defecto manual', () => {
    expect(migracion).toMatch(/add column if not exists origen text not null default 'manual'/);
    expect(migracion).toMatch(/check \(origen in \('manual', 'asistente'\)\)/);
  });

  it('el origen no se deduce de created_by', () => {
    // La razon de que sea columna propia: las ideas del generador llevan la
    // identidad administrativa de la sesion, asi que created_by no las delata.
    expect(data).toMatch(/origen: \(row\.origen as string\) === 'asistente'/);
    expect(data).not.toMatch(/origen:.*created_by/);
  });
});

describe('el servidor no se inventa el origen', () => {
  it('el servidor decide el origen y todo lo demas cae a manual', () => {
    // CAMBIADO el 2026-09-30. Antes leia `str(body.origen, 20)`, o sea que lo
    // decidia el navegador. Ahora lo decide la cabecera que lee el servidor.
    // La lectura y la decision estan en dos lineas distintas: primero se lee
    // la cabecera, despues se decide. El test comprueba las dos por separado en
    // vez de fingir que es una sola expresion.
    expect(ruta).toMatch(/const declarado = str\(ctx\.cabeceras\.get\(CABEZA_ORIGEN\), 20\)/);
    expect(ruta).toMatch(/const origen = declarado === 'asistente' \? 'asistente' : 'manual'/);
  });

  it('el insert guarda el origen', () => {
    expect(ruta).toMatch(/category: str\(body\.category, 80\) \|\| 'Sin categoría',\s*\n\s*origen,/);
  });

  it('el cliente de la UI no manda origen en absoluto', () => {
    // CAMBIADO el 2026-09-30, mismo motivo. El formulario manual no declara el
    // origen: no manda el campo y el tipo lo hace imposible de escribir.
    expect(cliente).not.toMatch(/origen: input\.origen/);
    expect(cliente).toMatch(/origen\?: never/);
  });
});

/** La tarjeta principal: del `<article>` a su cierre, sin contar caracteres. */
function bloqueDeTarjeta(codigo: string): string {
  const i = codigo.indexOf('<article');
  if (i < 0) return '';
  const fin = codigo.indexOf('</article>', i);
  return codigo.slice(i, fin > 0 ? fin : undefined);
}

describe('se ve en la interfaz', () => {
  it('la ficha lleva la insignia larga y el listado la corta', () => {
    expect(ficha).toMatch(/IdeaOrigenChip origen=\{idea\.origen\}/);
    expect(mapa).toMatch(/IdeaOrigenTag origen=\{idea\.origen\}/);
  });

  it('las dos insignias dicen de donde viene y que revisar', () => {
    expect(componente).toMatch(/MONTADA POR HERMES/);
    expect(componente).toMatch(/IDEA DEL EQUIPO/);
    // El aviso de revisarla es la parte que hace util la marca: una idea
    // montada por el asistente no entra igual a voting igual que una escrita.
    expect(componente).toMatch(/Revísala antes de aprobarla/);
  });

  it('el listado TRAE la columna origen: sin ella la insignia nunca se pinta', () => {
    // Fallo real de 2026-09-29: la insignia estaba en el componente correcto y la
    // tarjeta se pintaba bien, pero `getIdeas` enumera las columnas a mano y no
    // incluia `origen`. En produccion salian 0 de 41 marcadas sin un solo error.
    const select = datos.match(/export async function getIdeas[\s\S]*?\.select\('([^']+)'/);
    expect(select?.[1]).toContain('origen');
  });

  it('la insignia se ve en la TARJETA que se pinta, no en otra que no se usa', () => {
    // Dos fallos seguidos en el mismo sitio, ambos con 0 de 41 tarjetas y sin
    // ningun error: 1) la marca se puso solo en la ficha, y la tarjeta del
    // tablero es `project-map`; 2) dentro de project-map se puso en la tarjeta
    // de "espera respuesta" y no en la de la lista, que es la que se ve.
    // Por eso se comprueba que este dentro del bloque de la tarjeta principal,
    // y no que aparezca en cualquier parte del archivo.
    const chip = tarjetas.match(/\{idea\.origen === 'asistente' && <IdeaOrigen(Tag|Chip)/);
    expect(chip?.[0]).toBeTruthy();
    // la tarjeta de la lista: la que lleva portada, estado y titulo
    // MEDIDO 2026-10-04: el rango era `{0,3000}`, y al explicar el arreglo del
    // voto en un comentario el bloque llega a 3639. El test fallaba por eso: no
    // por un fallo de la insignia, sino por contar CARACTERES de comentario.
    //
    // Un tope de caracteres es un tope fragil en cualquier archivo con
    // comentarios. Lo que importa es el alcance de la tarjeta, y eso se mide
    // desde el `<article>` que la contiene, no contando caracteres.
    const tarjetaLista = bloqueDeTarjeta(tarjetas);
    expect(tarjetaLista).toMatch(/IdeaOrigen(Tag|Chip)/);
  });

  it('el tablero FILTRA por origen, y undefined cuenta como del equipo', () => {
    // El filtro tiene que ser la MISMA regla que la insignia: si una idea llega
    // sin `origen` se cuenta como del equipo. Si el filtro usara otra regla, la
    // insignia y el conteo contarian historias distintas sobre las mismas ideas.
    expect(tabs).toMatch(/asistente/);
    expect(tarjetas).toMatch(/\(idea\.origen \?\? 'manual'\) !== origen/);
    expect(tarjetas).toMatch(/origen !== 'all'/);
  });

  it('los conteos del filtro de origen salen de TODAS las ideas, no de las filtradas', () => {
    // Si salieran de `visible`, al elegir "del equipo" el boton de Hermes diria 0
    // y el filtro pareceria roto en vez de vacio.
    const conteos = tarjetas.match(/const origenCounts = \{[\s\S]*?\n  \};/)?.[0] ?? '';
    // Ninguna de las tres cifras puede venir de `visible`: si el "todas" saliera
    // de `visible` y las otras dos de `ideas`, el filtro dira 0 sin motivo.
    expect(conteos).toMatch(/all: ideas\.length/);
    expect(conteos).toMatch(/manual: ideas\.filter/);
    expect(conteos).toMatch(/asistente: ideas\.filter/);
    expect(conteos).not.toContain('visible');
  });

  it('la tarjeta MUESTRA la categoria: sin texto, el filtro no sirve de nada', () => {
    // `category` ya alimentaba el icono del formato, pero no se imprimia. Las
    // quince ideas quedaban visualmente identicas sin dejar ver por que estan
    // agrupadas. Agrupar en la base no sirve si luego no se ve en la tarjeta.
    const tarjetaLista = bloqueDeTarjeta(tarjetas);
    expect(tarjetaLista).toMatch(/\{idea\.category && \(/);
  });

  it('un origen desconocido se lee como del equipo, no como asistente', () => {
    expect(componente).toMatch(/origen === 'asistente' \? 'asistente' : 'manual'/);
  });
});

describe('El origen no lo declara el navegador (2026-09-30)', () => {
  // El bug: `origen` se leia del CUERPO del POST. Con eso, cualquier persona con
  // sesion mandaba `{"origen":"asistente"}` y su idea salia con la insignia de
  // montada por Hermes. La insignia existe justo para separar lo que nadie ha
  // revisado, asi que si se puede poner a mano no vale para nada.

  it('la API lee el origen de una cabecera, no del cuerpo', () => {
    // Y ninguna referencia a `body.origen` sobrevive EN CODIGO. Solo puede
    // aparecer en un comentario que explique el bug: los comentarios no se
    // ejecutan, y este archivo documenta el cambio a proposito. Por eso se
    // quitan los comentarios antes de comprobar, en vez de prohibir la palabra.
    const codigo = ruta.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(codigo).not.toMatch(/body\.origen/);
    expect(ruta).toMatch(/CABEZA_ORIGEN/);
    expect(ruta).toMatch(/ctx\.cabeceras\.get\(CABEZA_ORIGEN\)/);
  });

  it('el cliente de la UI no manda origen en el cuerpo', () => {
    expect(cliente).not.toMatch(/origen: input\.origen/);
    // Y el tipo lo vuelve imposible de escribir: `never` no admite 'asistente'.
    expect(cliente).toMatch(/origen\?: never/);
  });

  it('el valor se decide en el servidor y solo con dos salidas', () => {
    // La regla, escrita para que se lea sin bucear el codigo: el origen sale
    // de una variable que el servidor leyo de la cabecera, y hay exactamente
    // dos destinos. Cualquier otro caso cae a 'manual', que es el conservador.
    expect(ruta).toMatch(/const origen = declarado === 'asistente' \? 'asistente' : 'manual';/);
    // Y `declarado` no puede venir del cuerpo en ningun punto del archivo.
    expect(ruta).not.toMatch(/declarado = .*body/);
  });

  it('el origen no se consulta al votar', () => {
    // Blindar el origen NO puede volverse un filtro encubierto: las dos ideas
    // se votan EXACTAMENTE igual. La insignia es informativa y nada mas.
    // Se comprueba que en toda la ruta no haya ninguna comparacion de origen
    // que no sea la del alta.
    const usos = [...ruta.matchAll(/\borigen\b/g)].length;
    const comparaciones = [...ruta.matchAll(/origen\s*[!=]==?/g)].length;
    // Solo dos: la lectura del cuerpo al guardar y la comparacion del alta.
    expect(comparaciones).toBe(1);
    expect(usos).toBeLessThan(12);
  });
});
