import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

function leer(rel: string): string {
  return readFileSync(join(RAIZ, rel), 'utf8');
}

/**
 * MEDIDO 2026-10-04, Santiago: «quiero que pongas todas las ideas en votación. Que
 * apenas se suba una idea, se abra la votación directa. Que sea como el primer
 * estado posible, que ya no haya un estado anterior sino ese sea el primero».
 *
 * Antes, una idea nueva nacía en `draft` y de ahí había que pasarla a revisión
 * interna y luego a votación: dos pasos que alguien tenía que hacer A MANO. Una
 * idea recién creada era una fila muerta — nadie la miraba hasta que alguien se
 * acordaba. Y hay dos vías de creación (el formulario del hub y la API de
 * automatización, la que usa el generador): si solo se arregla una, las ideas que
 * llegan solas siguen naciendo muertas.
 *
 * `draft` no desaparece del tipo: hay filas viejas con ese valor en la base y un
 * 404 al abrir una de esas ideas sería peor que un estado sobrante. Lo que no
 * puede volver a pasar es que una idea NUEVA nazca ahí. Por eso el test mira las
 * dos vías de creación, no solo una.
 */
describe('una idea nueva nace abierta a votación', () => {
  it('el formulario del hub la crea en voting', () => {
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    // La inserción, no una mención en un comentario.
    const insercion = /from\('rr_hub_ideas'\)\s*\.insert\(\{[\s\S]*?\}\)/.exec(ruta);
    expect(insercion, 'no se encontro el insert de rr_hub_ideas').not.toBeNull();
    expect(insercion![0]).toMatch(/status:\s*'voting'/);
    expect(insercion![0]).not.toMatch(/status:\s*'draft'/);
  });

  it('la API de automatizacion tambien la crea en voting', () => {
    const ruta = leer('src/app/api/ideas/route.ts');
    const insercion = /from\('rr_hub_ideas'\)\s*\.insert\(\{[\s\S]*?\}\)/.exec(ruta);
    expect(insercion, 'no se encontro el insert de rr_hub_ideas').not.toBeNull();
    expect(insercion![0]).toMatch(/status:\s*'voting'/);
    expect(insercion![0]).not.toMatch(/status:\s*'draft'/);
  });

  it('la idea nace con su evento de votacion, no con uno de borrador', () => {
    // El evento es lo que cuenta la historia de la pieza. Si la idea nace en
    // `voting` pero el evento dice `draft`, la ficha muestra una historia que no
    // ocurrió, y eso es peor que no tenerla.
    //
    // OJO: `rr_hub_events` aparece DOS veces en la ruta del hub —una al cambiar
    // de estado (`to_status: to`) y otra al crear (`to_status: 'voting')—. Por
    // eso el patrón se ancla a `idea_id: idea.id`, que solo tiene el de crear.
    // Sin ese ancla el test se pasa mirando la transición y no dice nada.
    const hub = leer('src/app/api/workspace/[action]/route.ts');
    const eventoHub = /from\('rr_hub_events'\)\s*\.insert\(\{\s*idea_id: idea\.id,[\s\S]*?\}\)/.exec(hub);
    expect(eventoHub, 'no se encontro el evento de creacion en la ruta del hub').not.toBeNull();
    expect(eventoHub![0]).toMatch(/to_status:\s*'voting'/);
    expect(eventoHub![0]).not.toMatch(/to_status:\s*'draft'/);

    const api = leer('src/app/api/ideas/route.ts');
    const eventoApi = /from\('rr_hub_events'\)\s*\.insert\(\{[\s\S]*?actor_label:[\s\S]*?\}\)/.exec(api);
    expect(eventoApi, 'no se encontro el evento de creacion en la API de ideas').not.toBeNull();
    expect(eventoApi![0]).toMatch(/to_status:\s*'voting'/);
    expect(eventoApi![0]).not.toMatch(/to_status:\s*'draft'/);
  });

  it('voting sigue siendo un estado REAL, con su conteo', () => {
    // Que `voting` sea el de arranque no lo deja en el aire: sigue en el tipo, en
    // el orden y en la tabla de transiciones, y desde ahí se sale.
    const flow = leer('src/lib/flow.ts');
    expect(flow).toMatch(/'voting'/);
    // Salidas: al cliente al ganar, de vuelta a revisión al pausar.
    expect(flow).toMatch(/voting:\s*\[/);
  });

  it('la idea en voting es la que el servidor acepta votos', () => {
    // Si esto se desincroniza, toda idea nueva queda sin poder votarse y nadie
    // sabe por qué: el botón está, el perfil está, y el POST responde 409.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toMatch(/idea\.status\s*!==\s*'voting'/);
  });
});