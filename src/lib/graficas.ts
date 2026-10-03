/**
 * MEDIDO 2026-10-03. Gráficas del banco de ideas.
 *
 * Por qué esto existe y por qué NO usa `metrics`:
 *
 * La pantalla de MÉTRICAS (`src/app/[projectSlug]/metricas/page.tsx`) contaba
 * únicamente piezas `published`. MEDIDO en la base el 2026-10-03:
 *
 *     select status, count(*) from rr_hub_ideas group by 1;
 *     → published: 0
 *
 * Cero publicaciones. La página se veía vacía mientras el banco entero estaba
 * lleno: 61 ideas, 18 en `voting`, 18 en `approved`.
 *
 * `rr_hub_ideas.metrics` existe y las 61 filas lo tienen, pero TODAS valen
 * `{}` — es el default de la columna, no un dato. MEDIDO:
 *
 *     select count(*) from rr_hub_ideas
 *      where metrics is not null and metrics::text not in ('{}','null');
 *     → 0
 *
 * Graficar rendimiento con eso sería inventar. Lo que sí hay son las cifras de
 * PROCESO: en qué fase está cada pieza, cómo se reparten las aristas, qué tan
 * llena está la votación y qué pasa con las votaciones que piden cambio. Todo
 * eso sale de columnas que hoy devuelven filas de verdad, y por eso se puede
 * graficar sin inventar una sola cifra.
 *
 * Cuando `metrics` se empiece a llenar, estas gráficas son el sitio natural
 * para sumarlas. Hasta entonces, miden proceso y NO rendimiento, y lo dicen en
 * pantalla.
 */
/**
 * Tipo estructural mínimo, no `Idea` importado.
 *
 * MEDIDO 2026-10-03: `mapIdea` en `data.ts` no tiene tipo de retorno con
 * nombre — TypeScript lo infiere — y el tablero usa otro tipo, `BoardIdea`.
 * Importar cualquiera de los dos ataría estas gráficas a una forma que cambia.
 * Aquí solo se piden los tres campos que cada gráfica cuenta de verdad, y como
 * el resto es opcional cualquier idea sirve.
 */
import { PHASES, STATUS_LABEL, type WorkflowStatus } from './flow';

export type IdeaParaGraficas = {
  /** Necesario para cruzar con el conteo de votos, que viene indexado por id. */
  id: string;
  status: string;
  category?: string | null;
  content_type?: string | null;
};

export type Barra = { etiqueta: string; valor: number; tono?: 'fucsia' | 'mostaza' | 'neutro' };

/** Umbral de la regla de los 3 sí. Viene de `flow.ts`, no de un número suelto. */
export const VOTOS_NECESARIOS = 3;

/**
 * Las cinco gráficas, cada una con lo que mide y lo que NO puede medir.
 * `vacia` es el texto honesto para cuando no hay nada que dibujar: la gráfica
 * se muestra igual, explícitamente en cero, en vez de desaparecer.
 */
export type Grafica = {
  clave: string;
  titulo: string;
  /** Qué es exactamente este número. */
  mide: string;
  /** Por qué puede estar en cero. Se muestra al lado de los ceros. */
  vacia: string;
  barras: Barra[];
  total: number;
};

type Conteo = { aFavor: number; enContra: number };

/**
 * Fase por fase, en el ORDEN del flujo y no por cantidad: así se ve dónde se
 * atasca el banco de un vistazo. Un tablero ordenado por número esconde el
 * cuello de botella; uno ordenado por flujo lo enseña.
 */
export function graficaPorFase(ideas: readonly IdeaParaGraficas[]): Grafica {
  // MEDIDO 2026-10-03: esta lista de estados estaba escrita a mano y el portero
  // del repo (`npm run verify:states`) la rechaza, con razón: `flow.ts` es la
  // autoridad y un estado nuevo tiene que aparecer solo. Ahora sale de `PHASES`
  // y los rótulos de `STATUS_LABEL`, que además son los que ya usa el tablero:
  // antes esta gráfica decía "APROBADA" donde el tablero dice "IDEA APROBADA".
  const cuenta = new Map<string, number>();
  for (const idea of ideas) cuenta.set(idea.status, (cuenta.get(idea.status) ?? 0) + 1);

  // El orden del flujo, con cada estado una sola vez: `PHASES` es la autoridad
  // y las etiquetas salen de `STATUS_LABEL`, que son las mismas que ya usa el
  // tablero. Antes esta gráfica decía "APROBADA" donde el tablero dice
  // "IDEA APROBADA": dos nombres para la misma fase.
  const orden = [...new Set(PHASES.flatMap((f) => [...f.statuses] as string[]))];
  // Estas dos se pintan aunque valgan cero. Si solo aparecieran las que tienen
  // filas, un banco parado se vería como un banco vacío: `published` dio cero
  // durante meses sin que nadie lo notara.
  const SIEMPRE = new Set<string>([STATUS_LABEL.voting, STATUS_LABEL.published]);

  const barras = orden
    .map((status) => ({
      etiqueta: STATUS_LABEL[status as WorkflowStatus] ?? status,
      valor: cuenta.get(status) ?? 0,
      tono:
        status === 'voting' ? ('mostaza' as const)
        : status === 'published' ? ('fucsia' as const)
        : ('neutro' as const),
    }))
    .filter((b) => b.valor > 0 || SIEMPRE.has(b.etiqueta));

  return {
    clave: 'fase',
    titulo: 'DÓNDE ESTÁ EL BANCO',
    mide: 'Piezas por fase, en el orden del flujo.',
    vacia: 'Cero en todas las fases: el banco está vacío o no se está entrando.',
    barras,
    total: ideas.length,
  };
}

/** Las aristas. Vacía o 'Sin categoría' van juntas y se dicen, no se esconden. */
export function graficaPorArista(ideas: readonly IdeaParaGraficas[]): Grafica {
  const cuenta = new Map<string, number>();
  for (const idea of ideas) {
    const key = idea.category?.trim() || 'SIN CATEGORÍA';
    cuenta.set(key, (cuenta.get(key) ?? 0) + 1);
  }
  const barras = [...cuenta.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor, tono: 'neutro' as const }))
    .sort((a, b) => b.valor - a.valor);
  return {
    clave: 'arista',
    titulo: 'QUÉ SE ESTÁ PROYECTANDO',
    mide: 'Piezas por arista de contenido.',
    vacia: 'Nadie ha puesto arista todavía.',
    barras,
    total: ideas.length,
  };
}

/**
 * La healthier del banco. MEDIDO 2026-10-03: 18 piezas en `voting` y 6 votos en
 * toda la base, de 5 personas. Diecisiete de esas 18 no tenían NINGÚN voto.
 */
export function graficaVotacion(
  ideas: readonly IdeaParaGraficas[],
  votos: Readonly<Record<string, Conteo>>,
): Grafica {
  const enVotacion = ideas.filter((i) => i.status === 'voting');
  const listos = enVotacion.filter((i) => (votos[i.id]?.aFavor ?? 0) >= VOTOS_NECESARIOS);
  const conAlgunVoto = enVotacion.filter((i) => {
    const c = votos[i.id];
    return (c?.aFavor ?? 0) + (c?.enContra ?? 0) > 0;
  });
  const sinVoto = enVotacion.length - conAlgunVoto.length;
  const barras: Barra[] = [
    { etiqueta: 'CON LOS 3 SÍ', valor: listos.length, tono: 'fucsia' as const },
    { etiqueta: 'CON AL MENOS UN VOTO', valor: conAlgunVoto.length - listos.length, tono: 'mostaza' as const },
    { etiqueta: 'SIN NINGÚN VOTO', valor: sinVoto, tono: 'neutro' as const },
  ];
  return {
    clave: 'votacion',
    titulo: 'ESTÁ VOTANDO EL EQUIPO',
    mide: `Piezas en votación según cuánta gente ya votó. El umbral son ${VOTOS_NECESARIOS} sí.`,
    vacia: 'No hay nada en votación.',
    barras,
    total: enVotacion.length,
  };
}

/**
 * Cambio de chip: piezas con votaciones pedidas. El conteo de sí/no de
 * `getVotosDeVarias` NO ve estos votos, así que sin esta gráfica una idea con
 * un "cambiar esto" se ve idéntica a una que nadie ha tocado.
 */
export function graficaCambios(ideas: readonly IdeaParaGraficas[], pedidos: number): Grafica {
  const enCambios = ideas.filter((i) => i.status === 'needs_changes').length;
  return {
    clave: 'cambios',
    titulo: 'DÓNDE HAY FRICCIÓN',
    mide: 'Piezas esperando cambios y votos que pidieron un ajuste.',
    vacia: 'Nadie pidió cambios. Raro, pero es lo que dice la base.',
    barras: [
      { etiqueta: 'ESPERANDO CAMBIOS', valor: enCambios, tono: 'mostaza' as const },
      { etiqueta: 'VOTOS DE "CAMBIAR"', valor: pedidos, tono: 'neutro' as const },
    ],
    total: enCambios,
  };
}

/**
 * Reparto orgánico / pauta. MEDIDO: `origen` NO sirve aquí — vale `manual` /
 * `asistente`, que dice QUIÉN la escribió, no si se pautó. El tipo de contenido
 * (`organic` / `paid`) es la columna correcta, y el audit encontró que 23 de 24
 * piezas de pauta no tienen `ad_id`: es la foto del anuncio la que falta, no la
 * intención de pautar.
 */
export function graficaOrganicoPauta(ideas: readonly IdeaParaGraficas[]): Grafica {
  const organico = ideas.filter((i) => i.content_type === 'organic').length;
  const pauta = ideas.filter((i) => i.content_type === 'paid').length;
  const otro = ideas.length - organico - pauta;
  return {
    clave: 'tipo',
    titulo: 'ORGÁNICO O PAUTA',
    mide: 'Piezas por tipo de contenido. `origen` no se usa: dice quién escribió, no si se pautó.',
    vacia: 'Sin piezas todavía.',
    barras: [
      { etiqueta: 'ORGÁNICO', valor: organico, tono: 'fucsia' as const },
      { etiqueta: 'PAUTA', valor: pauta, tono: 'mostaza' as const },
      ...(otro > 0 ? [{ etiqueta: 'SIN TIPO', valor: otro, tono: 'neutro' as const }] : []),
    ],
    total: ideas.length,
  };
}

/** Todas las gráficas del banco, en el orden en que se pintan. */
export function todasLasGraficas(
  ideas: readonly IdeaParaGraficas[],
  votos: Readonly<Record<string, Conteo>>,
  cambiosPedidos: number,
): Grafica[] {
  return [
    graficaPorFase(ideas),
    graficaVotacion(ideas, votos),
    graficaPorArista(ideas),
    graficaOrganicoPauta(ideas),
    graficaCambios(ideas, cambiosPedidos),
  ];
}