import Link from 'next/link';

export type Crumb = { label: string; href?: string };

/** Deep-navigation trail: PROYECTO > BANCO > [O3] > DETALLE. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return <nav aria-label="Ruta de navegación" className="breadcrumb flex flex-wrap items-center gap-2">
    {items.map((item, index) => <span key={`${item.label}-${index}`} className="flex items-center gap-2">
      {index > 0 && <span className="text-blanco-20" aria-hidden>/</span>}
      {item.href ? <Link href={item.href} className="text-blanco-60 transition-colors hover:text-mostaza">{item.label}</Link> : <span className="text-mostaza">{item.label}</span>}
    </span>)}
  </nav>;
}
