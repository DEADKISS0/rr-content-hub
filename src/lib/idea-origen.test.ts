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

  it('un origen desconocido se lee como del equipo, no como asistente', () => {
    expect(componente).toMatch(/origen === 'asistente' \? 'asistente' : 'manual'/);
  });
});
