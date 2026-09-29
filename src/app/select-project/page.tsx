import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientesDeLaPersona } from '@/lib/data';
import { Icon } from '@/components/ui/icons';
import { ROLE_LABEL, type RoleKey } from '@/lib/flow';

/**
 * El hub visto desde fuera: qué clientes hay, cuáles puedes abrir y qué te vas a
 * encontrar dentro.
 *
 * Hasta el 2026-09-29 esta página leía `projects[0]` y se llamaba a sí misma
 * "ESPACIO ÚNICO": mostraba el cliente que ya tenías abierto y no había nada que
 * pulsar. Era el sitio donde un selector de clientes debería haber estado, y por
 * eso el enlace del pie apuntando aquí se llevaba a un callejón sin salida.
 *
 * Ahora la lista la da el servidor (`getClientesDeLaPersona`), y el cambio de
 * cliente lo decide `POST /api/cambiar-cliente`, que revalida la fila de acceso.
 * Esta página es el **índice**: explica, y quien quiera cambiar lo hace desde
 * aquí o desde el selector de la barra lateral.
 *
 * La lista corta de `CLIENTES_CONOCIDOS` manda sobre lo que hay en la base: un
 * cliente sin código de cuatro dígitos no tiene puerta, así que sale con candado.
 */
export default async function SelectProject() {
  const { abiertos, cerrados, actual } = await getClientesDeLaPersona();

  if (abiertos.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-negro px-5 py-20">
        <div className="w-full max-w-2xl border border-blanco-20 p-8 anim-rise">
          <p className="eyebrow">[RR CONTENT HUB]</p>
          <h1 className="mt-4 font-display text-4xl font-bold text-blanco">Sin clientes disponibles.</h1>
          <p className="mt-5 text-sm leading-7 text-blanco-60">
            Tu correo no tiene acceso a ningún cliente todavía. Pídeselo a quien administra el hub.
          </p>
        </div>
      </main>
    );
  }

  const steps = [
    { icon: 'spark' as const, label: 'IDEAS', text: 'La creativa propone; el cliente decide.' },
    { icon: 'pen' as const, label: 'GUIONES', text: 'Se escribe y se aprueba el plan.' },
    { icon: 'camera' as const, label: 'PRODUCCIÓN', text: 'Rodaje, crudo, montaje y corte final.' },
    { icon: 'publish' as const, label: 'PUBLICACIÓN', text: 'Sale, se registra la evidencia y se cierra.' },
  ];

  return (
    <main className="min-h-screen bg-negro px-5 py-10 md:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 border-b border-blanco-20 pb-10 anim-rise">
          <p className="eyebrow">[RR CONTENT HUB · {abiertos.length} {abiertos.length === 1 ? 'CLIENTE' : 'CLIENTES'}]</p>
          <h1 className="display-title">Tus clientes.</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-blanco-60">
            Cada cliente tiene su tablero, sus piezas y su equipo. Cambiar de cliente es cambiar de
            operación, no de cuenta: el rol se resuelve en cada una.
          </p>
        </header>

        <div className="space-y-px">
          {abiertos.map((cliente, indice) => {
            const esActual = cliente.slug === actual;
            return (
              <Link
                key={cliente.slug}
                href={`/${cliente.slug}`}
                className="group block border border-blanco-20 bg-blanco-05 p-7 transition-colors duration-300 hover:border-blanco-40 anim-rise md:p-10"
                style={{ animationDelay: `${indice * 120}ms` }}
              >
                <p className="mono-label text-blanco-50">
                  [{ROLE_LABEL[(cliente.rol ?? 'sin_rol') as RoleKey] ?? (cliente.rol ?? '').toUpperCase()}]
                  {esActual ? ' · AQUÍ ESTÁS' : ''}
                </p>
                <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <span
                      aria-hidden="true"
                      className="h-10 w-10 shrink-0 border border-blanco-40"
                      style={cliente.brand_primary_color ? { backgroundColor: cliente.brand_primary_color } : undefined}
                    />
                    <div>
                      <h2 className="font-display text-5xl font-bold text-blanco md:text-7xl">{cliente.name}</h2>
                      {cliente.description && (
                        <p className="mt-3 max-w-lg text-sm leading-6 text-blanco-60">{cliente.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 font-mono text-sm text-blanco-60">
                    ABRIR EL MAPA <Icon name="arrow" size={15} />
                  </span>
                </div>
                <ol className="mt-8 grid gap-px border-t border-blanco-20 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                  {steps.map((step, i) => (
                    <li key={step.label} className="flex items-start gap-3 pr-4">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-blanco-20 text-blanco-40">
                        <Icon name={step.icon} size={13} />
                      </span>
                      <span>
                        <strong className="block font-mono text-[10px] tracking-[0.08em] text-blanco">
                          {String(i + 1).padStart(2, '0')} · {step.label}
                        </strong>
                        <small className="mt-1 block font-mono text-[10px] leading-5 text-blanco-60">{step.text}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              </Link>
            );
          })}

          {cerrados.length > 0 && (
            <div className="border border-blanco-10 p-7">
              <p className="mono-label text-blanco-40">SIN ACCESO · {cerrados.length}</p>
              <ul className="mt-4 space-y-2">
                {cerrados.map((cliente) => (
                  <li key={cliente.slug} className="flex items-center gap-3 text-blanco-50">
                    <Icon name="lock" size={13} />
                    <span className="font-mono text-[10px] tracking-[0.08em]">{cliente.name.toUpperCase()}</span>
                    <span className="text-[10px] text-blanco-40">tu correo no tiene acceso</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {abiertos.length === 1 && (
          <p className="mt-8 font-mono text-[10px] text-blanco-50">
            ESTE ES EL ÚNICO CLIENTE QUE TIENES ABIERTO.{' '}
            ¿Solo necesitas revisar?{' '}
            <Link href={`/audit/${abiertos[0].slug}`} className="text-blanco-60 underline hover:text-blanco">
              ABRE LA AUDITORÍA
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
