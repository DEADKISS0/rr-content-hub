'use client';

/**
 * MEDIDO 2026-10-03. Las gráficas del banco de ideas.
 *
 * Antes la pantalla de MÉTRICAS contaba solo piezas `published` y en la base
 * hay CERO: se veía vacía con 61 ideas en el banco. Estas cinco gráficas salen
 * de columnas que hoy devuelven filas de verdad (fase, arista, tipo de
 * contenido, votos). El detalle de por qué no usan `metrics` está en
 * `src/lib/graficas.ts`, que es donde vive el dato; aquí solo se pinta.
 *
 * Aesthetic: fondo transparente para que el tablero mande, tipografía mono que
 * ya usa el Hub, y la barra fucsia / mostaza de la marca. La animación es
 * `width` de 0 al valor, que es barata y no joroba: se calcula el ancho en
 * porcentaje y se deja que el CSS lo interpole.
 */
import { useEffect, useRef, useState } from 'react';
import type { Grafica } from '@/lib/graficas';

/**
 * MEDIDO 2026-10-03 con la fórmula WCAG real sobre #070001:
 *
 *   barra `blanco-40` sobre su propia pista `blanco-10`  →  3.02:1   NO pasa AA
 *   barra `blanco-62` sobre su propia pista                →  6.42:1   sí pasa
 *
 * Con `blanco-40` las barras grises se perdían contra el fondo casi negro y
 * solo se distinguían las de color. Una barra que no se ve es una cifra que no
 * se lee, así que la neutra sube a 62 y conserva el aire de las otras.
 */
const TONO = {
  fucsia: 'bg-fucsia',
  mostaza: 'bg-mostaza',
  neutro: 'bg-blanco-70',
} as const;

function BarraGrafica({
  etiqueta,
  valor,
  maximo,
  tono,
  activo,
}: {
  etiqueta: string;
  valor: number;
  maximo: number;
  tono: keyof typeof TONO;
  activo: boolean;
}) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  const [ancho, setAncho] = useState(activo ? pct : 0);
  useEffect(() => {
    // MEDIDO 2026-10-03: `setAncho(pct)` directo aquí lo marca el lint
    // (`react-hooks/set-state-in-effect`): un setState sincrónico dentro de un
    // efecto cascada un render de más. Con `requestAnimationFrame` el ancho se
    // escribe DESPUÉS de pintar, que además es justo lo que hace que la barra
    // se vea crecer en vez de aparecer ya estirada.
    const id = requestAnimationFrame(() => setAncho(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_2.25rem] items-center gap-3 py-1.5">
      <span className="truncate font-mono text-[11px] text-blanco-70" title={etiqueta}>{etiqueta}</span>
      <span className="relative block h-3 bg-blanco-10" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${TONO[tono]}`}
          style={{ width: `${ancho}%` }}
        />
      </span>
      <span className="text-right font-mono text-xs font-bold tabular-nums text-blanco">{valor}</span>
    </li>
  );
}

function PanelGrafica({ g }: { g: Grafica }) {
  const ref = useRef<HTMLDivElement>(null);
  const [yaSeVio, setYaSeVio] = useState(false);
  // Las barras crecen cuando el panel entra en pantalla, no al montar: si
  // el usuario abre el tablero y las gráficas están más abajo, no
  // se ven correr mientras no hay nadie mirando.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        requestAnimationFrame(() => setYaSeVio(true));
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const maximo = Math.max(...g.barras.map((b) => b.valor), 0);
  const hayAlgo = g.barras.some((b) => b.valor > 0);

  return (
    <div ref={ref} className="border border-blanco-20 p-4">
      <p className="mono-label text-blanco-50">{g.titulo}</p>
      <ul className="mt-3">
        {g.barras.map((b) => (
          <BarraGrafica
            key={b.etiqueta}
            etiqueta={b.etiqueta}
            valor={b.valor}
            maximo={maximo}
            tono={b.tono ?? 'neutro'}
            activo={yaSeVio}
          />
        ))}
      </ul>
      <p className="mt-3 border-t border-blanco-10 pt-2 font-mono text-[10px] leading-4 text-blanco-50">
        {g.mide}
        {!hayAlgo && <span className="mt-1 block text-mostaza">{g.vacia}</span>}
      </p>
    </div>
  );
}

export function GraficasBanco({ graficas }: { graficas: Grafica[] }) {
  return (
    <section className="mx-auto mt-4 max-w-7xl px-5 md:px-10">
      <div className="mb-3 border-l-4 border-mostaza bg-blanco-05 p-4">
        <p className="font-mono text-[11px] leading-5 text-blanco-70">
          Esto mide <span className="font-bold text-blanco">PROCESO</span>, no rendimiento.
          Alcance, interacción y conversión no se pueden mostrar porque
          <span className="font-bold text-blanco"> ninguna tabla los registra todavía</span>
          {' '}(MEDIDO 2026-10-03: las 61 ideas tienen la columna de métricas
          vacía, cero con datos).
          Los números de abajo salen de las fases, las aristas y los votos, que sí existen.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {graficas.map((g) => <PanelGrafica key={g.clave} g={g} />)}
      </div>
    </section>
  );
}