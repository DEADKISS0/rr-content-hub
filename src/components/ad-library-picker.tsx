'use client';

import { useMemo, useState } from 'react';
import { Icon } from './ui/icons';

/**
 * Elige un anuncio de la biblioteca al crear una idea.
 *
 * La regla que gobierna todo esto: al elegir un anuncio se guarda el PUNTERO
 * (`ad_id`), no el texto. La ficha se lee por relación, y si mañana se corrige
 * el copy de un anuncio en la biblioteca, las 3 ideas que lo usan lo ven
 * actualizado. Copiar el texto sería tener 3 copias que se desincronizan sin
 * que nadie se entere.
 *
 * Qué RELLENA y qué NO toca:
 *
 * - La referencia: sí, siempre. Es lo que se está buscando.
 * - Título y objetivo: solo si estaban vacíos. Si la persona ya escribió, su
 *   texto manda. Un formulario que te pisa lo que escribiste es un formulario
 *   que nadie usa dos veces.
 */

export type AdPicked = {
  adId: string;
  adName: string;
  /** La referencia, para pintarla en el formulario. */
  reference: string;
  /** Propuestas: solo se aplican si el campo estaba vacío. */
  tituloSugerido: string;
  objetivoSugerido: string;
};

export function BotonBiblioteca({
  anuncios,
  usosPorAnuncio,
  onElegir,
}: {
  anuncios: { id: string; name: string; platform: string; format: string; externalUrl: string; objective: string; brand: string }[];
  usosPorAnuncio: Record<string, number>;
  onElegir: (elegido: AdPicked) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return anuncios;
    return anuncios.filter((a) =>
      [a.name, a.platform, a.format, a.brand, a.objective].some((campo) =>
        String(campo ?? '').toLowerCase().includes(termino),
      ),
    );
  }, [anuncios, busqueda]);

  if (!anuncios.length) {
    return (
      <p className="border-l-2 border-blanco-20 bg-blanco-05 px-4 py-3 font-mono text-[10px] leading-5 text-blanco-50">
        La biblioteca está vacía. Cuando Dirección cargue anuncios, salen aquí para no
        empezar cada idea desde cero.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 border-2 border-blanco-20 px-4 py-3 text-left hover:border-orquidea"
      >
        <span className="font-mono text-[10px] tracking-[0.15em] text-blanco-60">
          // ELEGIR UN ANUNCIO DE LA BIBLIOTECA
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-blanco-40">{anuncios.length}</span>
          <Icon name={abierto ? 'close' : 'search'} />
        </span>
      </button>

      {abierto ? (
        <div className="flex flex-col gap-2 border-2 border-t-0 border-blanco-20 p-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, marca o plataforma…"
            aria-label="Buscar en la biblioteca de anuncios"
            className="border border-blanco-30 bg-negro px-3 py-2 font-mono text-xs text-blanco placeholder:text-blanco-30 focus:border-orquidea focus:outline-none"
          />

          {filtrados.length === 0 ? (
            <p className="px-1 py-3 font-mono text-[10px] text-blanco-40">
              Nada con «{busqueda}». Prueba con menos palabras.
            </p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filtrados.map((anuncio) => {
                const usos = usosPorAnuncio[anuncio.id] ?? 0;
                return (
                  <li key={anuncio.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onElegir({
                          adId: anuncio.id,
                          adName: anuncio.name,
                          reference: anuncio.externalUrl,
                          tituloSugerido: anuncio.name,
                          objetivoSugerido: anuncio.objective,
                        });
                        setAbierto(false);
                        setBusqueda('');
                      }}
                      className="flex w-full flex-col gap-1 border-l-2 border-blanco-20 px-3 py-2 text-left hover:border-orquidea hover:bg-blanco-05"
                    >
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-sm font-bold text-blanco">{anuncio.name}</span>
                        <span className="font-mono text-[10px] text-orquidea">
                          {anuncio.platform} · {anuncio.format}
                        </span>
                        {anuncio.brand ? (
                          <span className="font-mono text-[10px] text-blanco-40">{anuncio.brand}</span>
                        ) : null}
                      </span>
                      {anuncio.objective ? (
                        <span className="font-mono text-[10px] leading-4 text-blanco-50">
                          {anuncio.objective}
                        </span>
                      ) : null}
                      {usos > 0 ? (
                        <span className="font-mono text-[10px] text-mostaza">
                          YA USADO EN {usos} {usos === 1 ? 'IDEA' : 'IDEAS'}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
