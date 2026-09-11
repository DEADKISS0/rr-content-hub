import Link from 'next/link';

export type VisualBrief = { intention?: string; camera?: string; talent?: string; edit?: string; avoid?: string };

/** Detects the source platform from a URL, for the header label. */
function platform(url: string) {
  if (url.includes('instagram')) return 'INSTAGRAM';
  if (url.includes('facebook')) return 'FACEBOOK';
  if (url.includes('tiktok')) return 'TIKTOK';
  if (url.includes('youtube') || url.includes('youtu.be')) return 'YOUTUBE';
  if (url.includes('drive.google.com')) return 'GOOGLE DRIVE';
  return 'EXTERNA';
}

function instagramEmbed(url: string) { const clean = url.split('?')[0].replace(/\/$/, ''); return `${clean}/embed/captioned/`; }
function youtubeEmbed(url: string) { const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/); return match ? `https://www.youtube.com/embed/${match[1]}` : null; }
function tiktokEmbed(url: string) { const match = url.match(/video\/(\d+)/); return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null; }
function driveEmbed(url: string) { const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|file\/d\/e\/)([\w-]+)/); if (!match) return null; const id = match[1]; return `https://drive.google.com/file/d/${id}/preview`; }

function embedSource(url: string) {
  if (url.includes('instagram.com')) return instagramEmbed(url);
  if (url.includes('youtube.com') || url.includes('youtu.be')) return youtubeEmbed(url);
  if (url.includes('tiktok.com')) return tiktokEmbed(url);
  if (url.includes('facebook.com')) return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=false&width=500`;
  if (url.includes('drive.google.com')) return driveEmbed(url);
  return null;
}

/**
 * Reference + brief side by side. The iframe alone says "what"; the brief says
 * "why". Keeping them together is what turns a link into an approved direction.
 */
export function ReferenceWithBrief({ url, title, brief }: { url?: string; title: string; brief: VisualBrief }) {
  if (!url) {
    return <section className="border-2 border-dashed border-blanco-20 p-8 text-center">
      <p className="mono-label text-mostaza">[REFERENCIA PENDIENTE]</p>
      <p className="mt-3 text-sm leading-6 text-blanco-60">Esta idea no tiene un referente visual todavía. El owner debe agregarlo antes de enviarla al cliente.</p>
    </section>;
  }

  const source = embedSource(url);
  const rows: Array<{ label: string; value?: string; tone?: string }> = [
    { label: 'INTENCIÓN', value: brief.intention },
    { label: 'CÁMARA', value: brief.camera },
    { label: 'TALENTO', value: brief.talent },
    { label: 'EDICIÓN', value: brief.edit },
    { label: 'QUÉ NO HACER', value: brief.avoid, tone: 'text-fucsia' },
  ].filter((row) => row.value);

  return <section className="overflow-hidden border-2 border-fucsia anim-fade">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-fucsia bg-fucsia/10 px-5 py-3">
      <p className="eyebrow text-fucsia">[REFERENCIA VISUAL · {platform(url)}]</p>
      <Link href={url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-fucsia underline">ABRIR ORIGINAL ↗</Link>
    </header>
    <div className="grid gap-px bg-blanco-10 lg:grid-cols-2">
      <div className="bg-black">
        {source ? <iframe title={`Referencia visual de ${title}`} src={source} className="h-[360px] w-full bg-white sm:h-[480px]" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" /> : <div className="grid h-[360px] place-items-center p-8 text-center sm:h-[480px]"><div><p className="font-mono text-xs text-blanco-60">PREVIEW NO DISPONIBLE PARA ESTE ORIGEN.</p><Link href={url} target="_blank" rel="noreferrer" className="mt-4 inline-block font-mono text-xs text-mostaza underline">VER REFERENCIA ORIGINAL ↗</Link></div></div>}
      </div>
      <div className="bg-negro p-6">
        <h3 className="font-display text-2xl font-bold text-blanco">¿POR QUÉ<br /><em className="text-fucsia">ESTA REFERENCIA?</em></h3>
        {rows.length ? <dl className="mt-6 space-y-5">
          {rows.map((row) => <div key={row.label}>
            <dt className="mono-label text-mostaza">// {row.label}</dt>
            <dd className={`mt-2 text-sm leading-7 ${row.tone ?? 'text-blanco-60'}`}>{row.value}</dd>
          </div>)}
        </dl> : <p className="mt-6 text-sm leading-7 text-blanco-40">El brief visual aún no se ha completado. El equipo debe documentar la dirección (intención, cámara, talento y edición) para que la referencia comunique una decisión y no solo un enlace.</p>}
      </div>
    </div>
  </section>;
}
