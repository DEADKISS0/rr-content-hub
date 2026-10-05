'use client';

import { useState } from 'react';
import { Icon } from './ui/icons';

type ContentType = 'all' | 'organic' | 'paid';

export function ContentTypeTabs({
  value,
  onChange,
  counts,
}: {
  value: ContentType;
  onChange: (type: ContentType) => void;
  counts: { all: number; organic: number; paid: number };
}) {
  const tabs: { key: ContentType; label: string; icon: 'leaf' | 'target' | 'grid' }[] = [
    { key: 'all', label: 'TODO', icon: 'grid' },
    { key: 'organic', label: 'ORGANICO', icon: 'leaf' },
    { key: 'paid', label: 'PAUTA', icon: 'target' },
  ];

  return (
    // MEDIDO 2026-10-04, Santiago: «no es responsive a celular».
    //
    // El `nav` era `flex gap-1` sin envolver. Las tres pestañas con `px-4` dan
    // 402 px de ancho: MEDIDO en producción, el botón «PAUTA 21» llegaba a
    // x=402 con un viewport de 390, y a x=402 con uno de 320. Se salía por la
    // derecha en ambos.
    //
    // Se deja de envolver a propósito: envolver parte el filtro en dos renglones
    // y lo que se busca es un filtro de tres palabras, no un párrafo. Con
    // `overflow-x-auto` las tres siguen en una línea y si no caben se deslizan,
    // que en un teléfono es lo natural.
    <nav
      aria-label="Tipo de contenido"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-current={active ? 'page' : undefined}
            className={`
              group inline-flex shrink-0 items-center gap-2 px-3 py-2.5 font-mono text-xs tracking-wider uppercase sm:px-4
              border transition-all duration-150
              ${active
                ? 'bg-blanco text-negro border-blanco font-bold'
                : 'bg-transparent text-blanco-60 border-blanco-20 hover:border-blanco-40 hover:text-blanco'
              }
            `}
          >
            <Icon name={tab.icon} size={13} className={active ? 'text-negro' : 'text-blanco-40 group-hover:text-blanco'} />
            {tab.label}
            <span className={`ml-1 text-[10px] ${active ? 'text-negro/60' : 'text-blanco-30'}`}>
              {counts[tab.key]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
