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
  it('solo admite los dos valores y cae a manual ante cualquier otro', () => {
    expect(ruta).toMatch(/const origen = str\(body\.origen, 20\) === 'asistente' \? 'asistente' : 'manual'/);
  });

  it('el insert guarda el origen', () => {
    expect(ruta).toMatch(/category: str\(body\.category, 80\) \|\| 'Sin categoría',\s*\n\s*origen,/);
  });

  it('el cliente manda manual salvo que se pida asistente', () => {
    expect(cliente).toMatch(/origen: input\.origen === 'asistente' \? 'asistente' : 'manual'/);
  });
});

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
    const tarjetaLista = tarjetas.match(/<IdeaCoverFrame[\s\S]{0,3000}?<\/Link>/);
    expect(tarjetaLista?.[0]).toMatch(/IdeaOrigen(Tag|Chip)/);
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
    const tarjetaLista = tarjetas.match(/<IdeaCoverFrame[\s\S]{0,3000}?<\/Link>/)?.[0] ?? '';
    expect(tarjetaLista).toMatch(/\{idea\.category && \(/);
  });

  it('un origen desconocido se lee como del equipo, no como asistente', () => {
    expect(componente).toMatch(/origen === 'asistente' \? 'asistente' : 'manual'/);
  });
});
