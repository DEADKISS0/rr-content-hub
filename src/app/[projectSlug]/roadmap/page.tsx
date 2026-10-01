import Link from 'next/link';
import { RoadmapView } from '@/components/roadmap-view';
import { planDe, todayIso } from '@/lib/roadmap';

/**
 * La fecha de hoy se resuelve aquí, en el servidor, y baja como dato.
 * Calcularla dentro del componente cliente daría HTML distinto en el servidor y
 * en el navegador — el aviso de hidratación clásico.
 *
 * MEDIDO 2026-10-01 (auditoría de experiencia de uso): esta página recibía
 * `params.projectSlug` y NO LO USABA. `/candilejas/roadmap` servía el plan de
 * WUNDEER: mismo eyebrow, mismas fechas, mismo director. Al equipo de
 * Candilejas le mostraban el plan del otro cliente como si fuera suyo, y no
 * había forma de saberlo desde la pantalla.
 *
 * Ahora el plan se busca por slug. Y si el cliente no tiene plan escrito, se
 * dice, en vez de enseñar el de otro: el plan de Candilejas no se inventa.
 */
export default async function RoadmapPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const plan = planDe(projectSlug);
  const hoy = todayIso();

  if (!plan) {
    return (
      <main className="min-h-screen bg-negro">
        <div className="mx-auto max-w-2xl px-5 py-16 md:px-10">
          <p className="eyebrow">{projectSlug.toUpperCase()} · ROADMAP</p>
          <h1 className="display-title mt-2">Este cliente aún no tiene plan.</h1>
          <p className="mt-5 text-base leading-7 text-blanco-70">
            No hay un roadmap escrito para este cliente, y no se va a enseñar el de
            otro. Se escribe el suyo —fechas, entregables, responsable— y aquí
            aparece.
          </p>
          <Link
            href={`/${projectSlug}`}
            className="btn-brutal mt-8 inline-flex items-center gap-2"
          >
            VOLVER AL TABLERO
          </Link>
        </div>
      </main>
    );
  }

  return <RoadmapView today={hoy} plan={plan} />;
}