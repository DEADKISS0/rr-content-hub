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
    <nav aria-label="Tipo de contenido" className="flex gap-1">
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-current={active ? 'page' : undefined}
            className={`
              group inline-flex items-center gap-2 px-4 py-2.5 font-mono text-xs tracking-wider uppercase
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
