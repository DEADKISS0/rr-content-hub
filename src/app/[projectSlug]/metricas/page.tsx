import { getIdeas, getProject } from '@/lib/data';
import { notFound } from 'next/navigation';
import { QueueSection } from '@/components/queue-section';
import { QUEUES, inQueue } from '@/lib/queues';

/**
 * This page used to be a byte-for-byte copy of `publicaciones` with different
 * copy: same queue, same filter, and it computed no metric at all. It now shows
 * the real counts, which is the only thing "MÉTRICAS" can honestly claim today.
 */
export default async function Metrics({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project } = await getProject(projectSlug); if (!project) notFound();
  const ideas = (await getIdeas(project.id)).filter((idea) => inQueue(idea.status, 'publicaciones'));

  const published = ideas.filter((i) => i.status === 'published');
  const organic = published.filter((i) => i.content_type === 'organic');
  const paid = published.filter((i) => i.content_type === 'paid');
  const byPillar = new Map<string, number>();
  for (const idea of published) {
    const key = idea.category || 'Sin categoría';
    byPillar.set(key, (byPillar.get(key) ?? 0) + 1);
  }
  const top = [...byPillar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return <>
    <QueueSection
      title="MÉTRICAS"
      eyebrow={`${project.name} · PERFORMANCE_LOOP`}
      description="Cuenta lo que sí se puede contar hoy: cuántas piezas salieron, de qué tipo y de qué categoría. El rendimiento (alcance, interacción, conversión) no se mide todavía porque ninguna tabla lo registra."
      owner="MEDIA BUYER · OWNER DEL PROYECTO"
      guide="Esta pantalla mide lo que existe en la base: piezas publicadas y su reparto. La hipótesis, la URL de salida y el resultado llegarán cuando se aplique la migración v3 (columnas metrics, published_url y due_at), que hoy NO está aplicada."
      ideas={ideas}
      projectSlug={projectSlug}
      empty="No hay publicaciones registradas todavía. Cuando la primera pieza salga, aquí se cuenta."
    />
    {published.length > 0 && <section className="mx-auto mt-4 max-w-7xl px-5 md:px-10">
      <p className="mono-label text-mostaza">[LO QUE SÍ PODEMOS MEDIR HOY]</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[['PUBLICADAS', published.length], ['ORGÁNICO', organic.length], ['PAUTA', paid.length]].map(([label, n]) => (
          <div key={String(label)} className="border-2 border-blanco-20 p-4">
            <p className="font-mono text-[10px] text-blanco-60">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-fucsia">{n}</p>
          </div>
        ))}
      </div>
      {top.length > 0 && <div className="mt-4 border-2 border-blanco-20 p-4">
        <p className="mono-label text-mostaza">[REPARTO POR CATEGORÍA]</p>
        <ul className="mt-3 space-y-2">
          {top.map(([cat, n]) => (
            <li key={cat} className="flex items-center justify-between border-b border-blanco-10 pb-2 font-mono text-xs">
              <span className="text-blanco">{cat}</span>
              <span className="text-mostaza">{n}</span>
            </li>
          ))}
        </ul>
      </div>}
      <p className="mt-4 border-l-4 border-mostaza bg-mostaza/10 p-4 text-xs leading-6 text-blanco-60">
        Alcance, interacción y conversión no se miden todavía: ninguna tabla registra
        ese dato. Hasta que exista, esta página solo cuenta piezas, no rendimiento.
      </p>
    </section>}
  </>;
}
