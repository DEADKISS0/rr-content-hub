import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-03. La portada (`src/app/page.tsx`) hacía `firstProject`:
 * cogía el PRIMER proyecto de la lista y lo pintaba como "PROYECTO ACTIVO", sin
 * mencionar que había más. Quien entraba con Candilejas abierto no veía que
 * Wundeer existía, y la página respondía "ya estás dentro" sin decir de qué se
 * trata. Eso es lo que hace inservible una portada: se entra a ciegas.
 *
 * Santiago lo pidió textual: "no muestra bien una página principal, como de qué
 * trata y elegir el proyecto".
 */
const portada = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8');
const codigo = portada.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('la portada explica de que trata antes de dar cifras', () => {
  it('no elige un proyecto por la persona', () => {
    // Se mira el CÓDIGO, no el archivo entero: el comentario que explica este
    // arreglo menciona `firstProject` a propósito, para que se sepa qué había.
    // Un aserto que lee el archivo entero obliga a borrar el motivo del fix.
    expect(codigo).not.toMatch(/firstProject/);
    // Elegir a ciegas es lo que escondía el otro cliente.
    expect(codigo).not.toMatch(/const project = found\.project/);
  });

  it('dice que es esto y para que sirve, en la propia pagina', () => {
    expect(portada).toMatch(/Aquí vive cada pieza de contenido/);
    expect(portada).toMatch(/idea|Idea/);
    expect(portada).toMatch(/guion|Guion|GUION/);
  });

  it('muestra el flujo entero, no solo "entrar"', () => {
    // Cuatro pasos: quien abre el link no sabe si mira un tablero, un CRM o un
    // calendario. Se resuelve sin entrar.
    for (const fase of ['LA IDEA', 'EL GUION', 'LA PRODUCCIÓN', 'LA SALIDA']) {
      expect(portada).toContain(fase);
    }
  });
});

describe('la portada deja elegir proyecto', () => {
  it('lista TODOS los clientes abiertos, no el primero', () => {
    expect(portada).toMatch(/conConteo\.map/);
    // El fix de raíz: el tipo de `abiertos` no declaraba `id`, que sí viene en
    // la fila, así que pedir el conteo por cliente no compilaba.
    const datos = readFileSync(join(process.cwd(), 'src/lib/data.ts'), 'utf8');
    expect(datos).toMatch(/abiertos: \{ id: string;/);
  });

  it('el conteo de cada uno sale de la base, no de un numero escrito', () => {
    expect(portada).toMatch(/getIdeas\(cliente\.id\)/);
    expect(portada).toMatch(/ideas\.length/);
  });

  it('marca cual esta abierto sin quitale la eleccion', () => {
    // `sesion.proyecto` es el cliente de la cookie. Va primero para no tener que
    // buscarlo, pero todos se ven: la decision sigue siendo de quien entra.
    expect(portada).toMatch(/sesion\.proyecto/);
    expect(portada).toMatch(/sesionActual/);
    expect(portada).toMatch(/AQUÍ ESTÁS/);
  });

  it('el cliente de la cookie va primero, no solo marcado', () => {
    // MEDIDO: basta con pintar "AQUÍ ESTÁS" y el cliente abierto queda donde
    // toque. Con dos clientes, quien entra a Candilejas tenía que buscarlo
    // entre las tarjetas. Aquí se ORDENA con la sesión, que es distinto de
    // elegir por la persona. Este aserto muerde si alguien quita el `sort`.
    // `[\s\S]*` en vez del flag `/s`: este proyecto compila a es2017 y el
    // flag no existe ahí. Un test que no compila es un test que no corre.
    expect(codigo).toMatch(/sort\([\s\S]*sesionActual/);
    // Y no puede ser un filtro que deje fuera al resto.
    expect(codigo).not.toMatch(/conConteo\s*=\s*conConteo\.filter\(/);
  });
});

describe('sin sesion no inventa nada', () => {
  it('manda al login, que es donde se teclea el codigo', () => {
    // El fallo del 2026-09-29 era peor: la raíz pedía los proyectos antes de
    // mirar la cookie y, sin sesión, culpaba a Supabase.
    expect(portada).toMatch(/redirect\('\/login'\)/);
    expect(codigo).not.toMatch(/Sin proyectos disponibles/);
    expect(codigo).not.toMatch(/Revisa la conexión con Supabase/);
  });

  it('con sesion pero sin clientes lo dice en la pagina, no con un 404', () => {
    expect(portada).toMatch(/abiertos\.length === 0/);
    expect(portada).toMatch(/Todavía no hay clientes|Todavía no tienes un cliente abierto/);
  });
});
