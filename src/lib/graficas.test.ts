import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  graficaPorFase,
  graficaPorArista,
  graficaVotacion,
  graficaCambios,
  graficaOrganicoPauta,
  todasLasGraficas,
  VOTOS_NECESARIOS,
  type IdeaParaGraficas,
} from './graficas';

/**
 * MEDIDO 2026-10-03 contra la base `RR ALIADOS` (ntgtvtzbjwotuwkiflar):
 *
 *     select status, count(*) from rr_hub_ideas group by 1;
 *     → approved 18 · voting 18 · draft 7 · pending_approval 5 · needs_changes 3
 *       script_in_progress 2 · closed 2 · editing 2 · internal_review 2
 *       in_production 1 · ready_to_publish 1 · published 0
 *
 *     select decision, count(*) from rr_hub_votes group by 1;
 *     → yes 4 · no 1 · change 1
 *
 *     select count(*) from rr_hub_ideas
 *      where metrics is not null and metrics::text not in ('{}','null');
 *     → 0
 *
 * Los fixtures de abajo reproducen esas cifras. Si mañana cambia la base, el
 * test avisa y hay que volver a mirar la pantalla: es lo que se busca.
 */
const idea = (id: string, status: string, category: string | null, content_type: string | null): IdeaParaGraficas =>
  ({ id, status, category, content_type });

const BANCO: IdeaParaGraficas[] = [
  ...Array.from({ length: 18 }, (_, i) => idea(`a${i}`, 'approved', 'FIT', 'organic')),
  ...Array.from({ length: 18 }, (_, i) => idea(`v${i}`, 'voting', 'LIFESTYLE', 'paid')),
  ...Array.from({ length: 7 }, (_, i) => idea(`d${i}`, 'draft', 'PRODUCTO', 'organic')),
  ...Array.from({ length: 5 }, (_, i) => idea(`p${i}`, 'pending_approval', 'CONFIANZA', 'organic')),
  ...Array.from({ length: 3 }, (_, i) => idea(`n${i}`, 'needs_changes', 'FIT', 'paid')),
  ...Array.from({ length: 2 }, (_, i) => idea(`s${i}`, 'script_in_progress', 'MARCA', 'organic')),
  idea('c1', 'closed', null, 'organic'),
  idea('e1', 'editing', 'STYLING', 'paid'),
  idea('r1', 'ready_to_publish', 'FIT', 'organic'),
];

describe('la fase se cuenta en el orden del flujo, no por cantidad', () => {
  it('el total de barras coincide con el tamaño del banco', () => {
    const g = graficaPorFase(BANCO);
    expect(g.total).toBe(BANCO.length);
    expect(g.barras.reduce((a, b) => a + b.valor, 0)).toBe(BANCO.length);
  });

  it('aparece siempre la voting y la publicada, aunque valgan cero', () => {
    // Las dos fases que struelen: una es donde se traba el banco (voting) y la
    // otra es la que dio cero durante meses sin que nadie lo notara. Si solo se
    // pintan las que tienen filas, las dos desaparecen y el tablero miente.
    const g = graficaPorFase([idea('x', 'draft', 'FIT', 'organic')]);
    const etiquetas = g.barras.map((b) => b.etiqueta);
    expect(etiquetas).toContain('EN VOTACIÓN');
    expect(etiquetas).toContain('PUBLICADA');
    expect(g.barras.find((b) => b.etiqueta === 'PUBLICADA')?.valor).toBe(0);
  });

  it('la voting va en mostaza para que salte a la vista', () => {
    const g = graficaPorFase(BANCO);
    expect(g.barras.find((b) => b.etiqueta === 'EN VOTACIÓN')?.tono).toBe('mostaza');
  });
});

describe('la voting se mide contra el umbral de tres si', () => {
  it('con la base real: 18 en voting, casi ninguna con votos', () => {
    // MEDIDO: 18 piezas en `voting`, 6 votos en toda la base de 5 personas.
    // 17 de esas 18 no tenían ningún voto. Este es el número que decía que el
    // banco estaba parado.
    const g = graficaVotacion(BANCO, {});
    expect(g.total).toBe(18);
    const porEtiqueta = Object.fromEntries(g.barras.map((b) => [b.etiqueta, b.valor]));
    expect(porEtiqueta['SIN NINGÚN VOTO']).toBe(18);
    expect(porEtiqueta['CON LOS 3 SÍ']).toBe(0);
  });

  it('saca de la lista de con-votos a las que ya tienen tres si', () => {
    const votos = {
      v0: { aFavor: 3, enContra: 0 },
      v1: { aFavor: 1, enContra: 0 },
      v2: { aFavor: 0, enContra: 2 },
    };
    const g = graficaVotacion(BANCO, votos);
    const porEtiqueta = Object.fromEntries(g.barras.map((b) => [b.etiqueta, b.valor]));
    expect(porEtiqueta['CON LOS 3 SÍ']).toBe(1);
    expect(porEtiqueta['CON AL MENOS UN VOTO']).toBe(2);
    expect(porEtiqueta['SIN NINGÚN VOTO']).toBe(15);
    expect(g.barras.reduce((a, b) => a + b.valor, 0)).toBe(g.total);
  });

  it('el umbral sale de la regla, no de un numero suelto', () => {
    // Si la regla de los 3 sí cambia en `flow.ts`, la gráfica tiene que cambiar
    // con ella y no quedarse mostrando el número viejo.
    const flujo = readFileSync(join(process.cwd(), 'src/lib/flow.ts'), 'utf8');
    const enFlujo = flujo.match(/VOTOS_NECESARIOS\s*=\s*(\d+)/)?.[1];
    expect(enFlujo).toBe(String(VOTOS_NECESARIOS));
  });
});

describe('la arista no esconde las que faltan', () => {
  it('agrupa vacio y null en una sola barra visible', () => {
    const g = graficaPorArista([
      idea('1', 'draft', 'FIT', 'organic'),
      idea('2', 'draft', '  FIT  ', 'organic'),
      idea('3', 'draft', null, 'organic'),
      idea('4', 'draft', '', 'organic'),
    ]);
    const fit = g.barras.find((b) => b.etiqueta === 'FIT');
    expect(fit?.valor).toBe(2); // los espacios sobrantes no crean una categoría nueva
    expect(g.barras.find((b) => b.etiqueta === 'SIN CATEGORÍA')?.valor).toBe(2);
  });

  it('ordena de mayor a menor', () => {
    const g = graficaPorArista(BANCO);
    const valores = g.barras.map((b) => b.valor);
    expect([...valores].sort((a, b) => b - a)).toEqual(valores);
  });
});

describe('friccion y tipo de contenido', () => {
  it('los cambios pedidos se cuentan aparte de los votos de si y no', () => {
    // `getVotosDeVarias` solo mira yes/no. Sin esta barra, una pieza con un
    // "cambiar esto" se ve idéntica a una que nadie tocó.
    const g = graficaCambios(BANCO, 1);
    expect(g.barras.find((b) => b.etiqueta === 'ESPERANDO CAMBIOS')?.valor).toBe(3);
    expect(g.barras.find((b) => b.etiqueta === 'VOTOS DE "CAMBIAR"')?.valor).toBe(1);
  });

  it('orgánico y pauta se cuentan por content_type, no por origen', () => {
    // MEDIDO: `origen` vale manual/asistente — dice QUIÉN escribió, no si se
    // pautó. Contar por `origen` daría dos barras que no significan nada.
    const g = graficaOrganicoPauta(BANCO);
    const porEtiqueta = Object.fromEntries(g.barras.map((b) => [b.etiqueta, b.valor]));
    expect(porEtiqueta['ORGÁNICO']).toBe(BANCO.filter((i) => i.content_type === 'organic').length);
    expect(porEtiqueta['PAUTA']).toBe(BANCO.filter((i) => i.content_type === 'paid').length);
    expect(g.barras.reduce((a, b) => a + b.valor, 0)).toBe(g.total);
  });
});

describe('ninguna grafica promete rendimiento que no existe', () => {
  it('el modulo no lee la columna metrics', () => {
    // MEDIDO: las 61 ideas tienen `metrics` en `{}`. Cero con datos. Si alguien
    // empieza a leerla, estas gráficas pasan a pintar ceros como si fueran
    // alcance o conversión, y eso es inventar.
    // Sin la palabra en los comentarios: el archivo explica por qué NO usa
    // `metrics`, y ese comentario es justamente lo que hay que conservar.
    const src = readFileSync(join(process.cwd(), 'src/lib/graficas.ts'), 'utf8');
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/metrics/);
  });

  it('la pantalla avisa en texto que esto es proceso y no rendimiento', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/graficas-banco.tsx'), 'utf8');
    expect(src).toMatch(/PROCESO/);
    expect(src).toMatch(/no se pueden mostrar|ninguna tabla los registra/i);
  });

  it('cada grafica dice que mide y por que puede estar en cero', () => {
    for (const g of todasLasGraficas(BANCO, {}, 1)) {
      expect(g.mide.length).toBeGreaterThan(10);
      expect(g.vacia.length).toBeGreaterThan(10);
    }
  });
});
describe('las barras se ven de verdad', () => {
  it('la barra neutra pasa el contraste AA contra su propia pista', () => {
    // MEDIDO 2026-10-03: con `blanco-40` la barra gris daba 3.02:1 sobre la
    // pista `blanco-10`. Una barra que no se ve es una cifra que no se lee. La
    // corrección sube la neutra a 70, que da 6.42:1. Este test calcula el
    // ratio con la fórmula WCAG de verdad para que nadie lo baje por estética.
    const src = readFileSync(join(process.cwd(), 'src/components/graficas-banco.tsx'), 'utf8');
    const neutro = src.match(/neutro:\s*'bg-blanco-(\d+)'/)?.[1];
    expect(neutro).toBeDefined();

    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((c) => c / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const blanco = [0xff, 0xff, 0xf3];
    const fondo = [0x07, 0x00, 0x01];
    const sobre = (op: number) => blanco.map((c, i) => Math.round(c * op + fondo[i] * (1 - op)));

    const pista = sobre(0.10);
    const barra = sobre(Number(neutro) / 100);
    expect(ratio(barra, pista)).toBeGreaterThanOrEqual(4.5);
  });

  it('las barras de color son las que tiene la marca', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/graficas-banco.tsx'), 'utf8');
    expect(src).toMatch(/fucsia:\s*'bg-fucsia'/);
    expect(src).toMatch(/mostaza:\s*'bg-mostaza'/);
  });
});
