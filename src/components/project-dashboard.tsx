import Link from 'next/link';
import { ProjectMap, type BoardIdea } from '@/components/project-map';
import { Chip, Initials } from '@/components/ui/chips';
import { Icon } from '@/components/ui/icons';
import { ROLE_LABEL, statusMeta, esTerminal, type RoleKey } from '@/lib/flow';
import { contarEsperas } from '@/lib/esperas';
import { QUEUES } from '@/lib/queues';

type Project = { name: string; client_name: string; description?: string | null };

// «Trabado» es exactamente lo que espera una decisión: la cola de aprobaciones.
// Sale de QUEUES (que a su vez deriva del motor de flujo) porque la regla del
// repo es que ninguna pantalla vuelva a escribir una lista de estados a mano.
const WAITING_STATUSES: readonly string[] = QUEUES.aprobaciones.statuses;

/**
 * Pantalla principal de un proyecto.
 *
 * Orden de lectura deliberado: quién eres y qué se puede hacer (cabecera) →
 * dónde está todo (mapa) → qué está trabado y por quién (panel de bloqueos).
 * El panel de bloqueos ya no es un número: son piezas concretas con su
 * responsable delante.
 */
export function ProjectDashboard({ project, projectSlug, ideas, role }: { project: Project; projectSlug: string; ideas: BoardIdea[]; role: string }) {
  /**
   * Lo que el equipo tiene pendiente, que NO es lo mismo que "paradas".
   *
   * `WAITING_STATUSES` es la cola de aprobaciones: espera a alguien de fuera. El
   * chip decía "N PIEZAS PARADAS" y ese número era 6 mientras 19 piezas más
   * esperaban una acción interna. La palabra "paradas" además accusesa mal: una
   * pieza esperando aprobación del cliente no está parada, está en manos de otro.
   *
   * La separación importa porque las dos cosas piden acciones distintas: una
   * exige un empujón del equipo, la otra una respuesta del cliente.
   * Presentarlas sumadas —o solo una— hace que el tablero diga una cosa y el
   * trabajo real sea otro.
   *
   * Ojo con `WAITING_STATUSES`: esa cola incluye `needs_changes`, que NO espera
   * al cliente — el cliente ya pidió cambios y le toca al equipo rehacerlo. Por
   * eso aquí se filtra aparte y va a la cuenta de abajo: son 3 piezas que el
   * tablero atributos al cliente y no lo son.
   */
  /*
   * MEDIDO 2026-10-01: estas dos líneas eran la causa de que el tablero se
   * contradijera en la misma pantalla. `esperandoEquipo` contaba
   * `!esTerminal(status)` —44 de 45— mientras `start-here.tsx` contaba solo
   * `QUEUES.aprobaciones.statuses` —6—. Las dos reglas eran correctas según su
   * propia definición, y por eso no se podían cruzar: nadie sabía cuál mandaba.
   *
   * Ahora las dos pantallas usan `contarEsperas` de `@/lib/esperas`. El número
   * grande de arriba (piezas abiertas) se llama `abiertas` a propósito: son
   * cosas distintas y no vuelven a aparecer como si fueran el mismo número.
   */
  const conteo = contarEsperas(ideas, esTerminal);
  const esperandoCliente = conteo.esperandoCliente;
  const esperandoEquipo = conteo.esperandoEquipo;
  const byActor = esperandoCliente.reduce<Record<string, BoardIdea[]>>((groups: Record<string, BoardIdea[]>, idea: BoardIdea) => {
    const who = statusMeta(idea.status).who;
    groups[who] = [...(groups[who] ?? []), idea];
    return groups;
  }, {});
  /** Lo mismo, para la espera interna: agrupado por rol, no por "quién". */
  const porRolEquipo = esperandoEquipo.reduce<Record<string, BoardIdea[]>>((groups: Record<string, BoardIdea[]>, idea: BoardIdea) => {
    const rol = statusMeta(idea.status).who;
    groups[rol] = [...(groups[rol] ?? []), idea];
    return groups;
  }, {});
  const roleLabel = ROLE_LABEL[role as RoleKey] ?? role.toUpperCase();

  return (
    <main className="min-h-screen bg-negro">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
        <header className="anim-rise mb-10 grid gap-8 border-b border-blanco-20 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="eyebrow">[{project.name.toUpperCase()} · OPERACIÓN VIVA]</p>
            <h1 className="display-title">El trabajo visible.</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-blanco-70">
              {project.description ?? 'Cada pieza avanza de izquierda a derecha. El ícono, el color y el texto te dicen quién tiene la pelota.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Chip icon="user" tone="blanco">TU ROL: {roleLabel}</Chip>
              <Chip icon="pieces" tone="neutro">{ideas.length} PIEZAS EN EL HUB</Chip>
              {/* El número grande es "piezas", no "piezas esperando". Antes los
                  dos chips de abajo se leían como el mismo total y no lo eran:
                  44 contra 6. Ahora cada uno tiene su regla y su nombre. */}
              {/* El número que antes decía "PARADAS" era solo la espera externa.
                  Las dos cuentas van separadas porque son dos trabajos: una la
                  saca el cliente, la otra el equipo. */}
              <Chip icon="alert" tone="neutro">{esperandoCliente.length} ESPERANDO AL CLIENTE</Chip>
              <Chip icon="clock" tone="neutro">{esperandoEquipo.length} PARA QUE AVANCE EL EQUIPO</Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${projectSlug}/ideas`} className="btn-brutal inline-flex items-center gap-2">VER TODO <Icon name="arrow" size={14} /></Link>
          </div>
        </header>

        <ProjectMap ideas={ideas} projectSlug={projectSlug} />

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="border border-blanco-20 bg-blanco-05 p-6 sm:p-8">
            <p className="eyebrow">[QUIÉN TIENE LA PELOTA]</p>
            <p className="mt-3 font-display text-6xl font-bold leading-none text-blanco">{esperandoCliente.length}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-blanco">
              {esperandoCliente.length ? 'Esperan a alguien de fuera.' : 'Nada espera al cliente.'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-blanco-70">
              {esperandoCliente.length
                ? 'Estas piezas están en manos del cliente. Si no se mueven, no es un fallo del hub: es una decisión que no ha llegado.'
                : 'Ninguna pieza depende hoy de una aprobación externa.'}
            </p>
            <Link href={`/${projectSlug}/aprobaciones`} className="mt-5 inline-flex min-h-[44px] items-center gap-2 font-mono text-xs text-blanco-60 underline hover:text-blanco">
              VER DECISIONES <Icon name="arrow" size={13} />
            </Link>
            {/* El equipo tiene su propia cuenta y su propia frase. Antes solo
                existía el número externo, y el tablero parecía tranquilo con 14
                piezas esperando un empujón interno. */}
            {esperandoEquipo.length > 0 && (
              <div className="mt-7 border-t border-blanco-20 pt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-orquidea">
                  Y ADEMÁS, {esperandoEquipo.length} ESPERANDO QUE EL EQUIPO LAS MUEVA
                </p>
                <p className="mt-2 text-sm leading-6 text-blanco-70">
                  Estas no dependen de nadie de fuera: están listas para que alguien las empuje.
                  Son el trabajo que depende de nosotros, no una espera.
                </p>
                <p className="mt-3 font-display text-sm font-bold text-blanco">
                  {esperandoEquipo.map((idea) => idea.code ?? 'IDEA').join(' · ')}
                </p>
              </div>
            )}
          </div>

          <div className="border border-blanco-20 p-5 sm:p-6">
            <p className="eyebrow">[QUIÉN ESTÁ ESPERANDO QUÉ]</p>
            {esperandoCliente.length ? (
              <ul className="mt-4 space-y-3">
                {Object.entries(byActor).map(([who, items]) => (
                  <li key={who} className="flex items-start gap-3 border-b border-blanco-10 pb-3 last:border-0 last:pb-0">
                    <Initials label={who} tone="neutro" size={30} />
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-blanco-50">{who} · {items.length} PIEZA{items.length === 1 ? '' : 'S'}</p>
                      <p className="mt-1 truncate font-display text-sm font-bold text-blanco">
                        {items.map((idea) => idea.code ?? 'IDEA').join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-blanco-60">Nadie espera al cliente: ninguna pieza depende hoy de una aprobación externa.</p>
            )}

            {esperandoEquipo.length > 0 && (
              <div className="mt-6 border-t border-blanco-20 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-orquidea">
                  ESPERANDO QUE LAS MUEVA EL EQUIPO · {esperandoEquipo.length}
                </p>
                <ul className="mt-3 space-y-2">
                  {Object.entries(porRolEquipo).map(([rol, items]) => (
                    <li key={rol} className="flex items-baseline gap-2">
                      <span className="w-24 shrink-0 font-mono text-[10px] text-blanco-50">{rol}</span>
                      <span className="font-display text-sm font-bold text-blanco">
                        {items.map((idea) => idea.code ?? 'IDEA').join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
