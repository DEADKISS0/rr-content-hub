import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-01, Santiago: «no esta funcionando muy bien el tema de el como
 * se usa». Recorri el flujo real en el navegador y conte, en el tablero abierto:
 *
 *   #0 "VER MÁS"                             alto=32  abierto=false
 *   #1 "AAlejandra Suarez"                    alto=30  abierto=false
 *   #2 "VISTA Y RESPONSABLE"                  alto=30  abierto=false
 *   #3 "VER TODAS LAS 46 PIEZAS Y EL MAPA..."  alto=46  abierto=false
 *
 * Las tarjetas con boton A FAVOR viven dentro del #3, el CUARTO desplegable de
 * la pantalla. Quien abre el hub por primera vez ve 46 tarjetas resumidas sin
 * un solo boton de voto y no tiene forma de saber que tiene que buscar esa
 * linea de texto. Ese es el motivo real de que el hub se percibiera roto.
 */
describe('las ideas en votacion tienen que verse sin descubrir nada', () => {
  const mapa = readFileSync(
    join(process.cwd(), 'src/components/project-map.tsx'),
    'utf8'
  );

  it('cuenta las ideas en votacion por su estado real, no por grupo de actor', () => {
    // `waitingClient` son las que esperan al CLIENTE. No son las que se votan:
    // usarla para abrir el desplegable abria por las ideas equivocadas.
    expect(mapa).toMatch(/ideas\.filter\(\(idea\) => idea\.status === 'voting'\)/);
  });

  it('abre el desplegable solo cuando hay ideas en votacion', () => {
    expect(mapa).toMatch(/useState<boolean \| undefined>\(\s*ideas\.some\(\(idea\) => idea\.status === 'voting'\) \? true : undefined\s*\)/);
  });

  it('el estado es real, no la prop suelta: con `open` a secas React deja de respetarlo', () => {
    expect(mapa).toMatch(/open=\{dirty \|\| todasAbiertas\}/);
    expect(mapa).toMatch(/onToggle=/);
  });

  it('el resumen dice cuantas hay para votar y que hay que abrirlo', () => {
    expect(mapa).toMatch(/ABRILO: \{enVotacion\} PARA VOTAR/);
  });

  it('el boton de voto rapido sigue montado en las tarjetas', () => {
    expect(mapa).toMatch(/VoteQuick/);
  });
});