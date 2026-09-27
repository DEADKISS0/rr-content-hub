'use client';

import { useCallback, useEffect, useState } from 'react';
import { assignOwner, loadRoster, type RosterMember } from '@/lib/workspace-client';
import { ROLE_LABEL, type RoleKey } from '@/lib/flow';
import { Icon } from '@/components/ui/icons';

/**
 * Asignar responsable.
 *
 * En modo abierto todo cambio que se hace en una pieza queda firmado como
 * "sin sesión". Es honesto —no se inventa quién fue— pero deja la pieza sin
 * dueño: nadie sabe a quién preguntarle. Este bloque deja nombrar a una persona
 * REAL del roster, y el nombre se escribe en `rr_hub_ideas.created_by`.
 *
 * Lo que este componente NO hace:
 * - No decide quién puede asignar: lo dice el servidor, y si no es `owner`
 *   devuelve 403. Aquí solo se oculta el botón si el rol no es de owner.
 * - No confía en su propia lista: el `userId` viaja al servidor, que vuelve a
 *   comprobar que esa persona tenga acceso al proyecto.
 *
 * Por qué no es un `transition`: escribir en `created_by` es metadata, no un
 * cambio de fase. Meterlo en `allowedTransitions()` sería inventar una fase que
 * no existe en el flujo de 13 estados.
 */
export function AssignOwner({
  ideaId,
  projectSlug,
  currentName,
  canAssign,
}: {
  ideaId: string;
  projectSlug: string;
  currentName: string | null;
  canAssign: boolean;
}) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [elegido, setElegido] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [fallo, setFallo] = useState('');

  const cargar = useCallback(() => {
    if (!canAssign) return;
    loadRoster(projectSlug).then(setRoster);
  }, [projectSlug, canAssign]);

  useEffect(() => {
    // El roster se pide una vez al montar, nunca en el render: la lista es un
    // dato del servidor y pintarla sin await sería una condición de carrera.
    const timer = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  async function confirmar() {
    if (!elegido || busy) return;
    setBusy(true);
    setFallo('');
    const { error, nombre } = await assignOwner({ ideaId, projectSlug, userId: elegido });
    setBusy(false);
    if (error) { setFallo(error); return; }
    setNotice(`✓ ${nombre ?? 'Responsable'} es ahora el responsable de esta pieza.`);
    setElegido('');
    window.setTimeout(() => window.location.reload(), 1200);
  }

  // Con responsable asignado, el bloque es un dato, no un formulario: la única
  // acción que tiene sentido es cambiarla, y esa se abre a propósito.
  const [cambiar, setCambiar] = useState(false);

  if (!canAssign) {
    return currentName ? (
      <div className="border border-blanco-20 p-5">
        <p className="mono-label text-blanco-50">// RESPONSABLE</p>
        <p className="mt-3 font-display text-lg font-bold text-blanco">{currentName}</p>
      </div>
    ) : null;
  }

  return (
    <div className="border border-blanco-20 p-5 anim-rise">
      <p className="mono-label text-blanco-50">// RESPONSABLE DE LA PIEZA</p>

      {currentName && !cambiar ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-blanco-30 font-mono text-sm text-blanco-80">
              {currentName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-blanco">{currentName}</p>
              <p className="font-mono text-[10px] text-blanco-50">RESPONSABLE ASIGNADO</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCambiar(true)}
            className="btn-ghost shrink-0"
          >
            CAMBIAR
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs leading-5 text-blanco-60">
            Sin responsable, cualquier cambio queda como &quot;sin sesión&quot;. Nombra a
            alguien del equipo y la pieza deja de ser huérfana.
          </p>
          <label className="mt-4 block">
            <span className="mono-label mb-2 block text-blanco-50">// QUIÉN RESPONDE</span>
            <select
              value={elegido}
              onChange={(event) => setElegido(event.target.value)}
              className="input-brutal"
              disabled={busy}
            >
              <option value="">Elige una persona…</option>
              {roster.map((persona) => (
                <option key={persona.userId} value={persona.userId}>
                  {persona.nombre} — {ROLE_LABEL[persona.rol as RoleKey] ?? persona.rol}
                </option>
              ))}
            </select>
          </label>
          {roster.length === 0 && (
            <p className="mt-3 font-mono text-[10px] text-mostaza">
              NO HAY ROSTRO EN ESTE PROYECTO.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={confirmar}
              disabled={!elegido || busy}
              className="btn-brutal inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="check" size={13} />
              {busy ? 'ASIGNANDO…' : 'ASIGNAR RESPONSABLE'}
            </button>
            {currentName && cambiar && (
              <button
                type="button"
                onClick={() => setCambiar(false)}
                className="font-mono text-xs text-blanco-60 underline transition-colors hover:text-blanco"
              >
                CANCELAR
              </button>
            )}
          </div>
        </>
      )}

      {notice && <p id="aviso-responsable" role="status" className="mt-4 border-l-4 border-l-orquidea bg-blanco-05 px-3 py-2 text-sm leading-6 text-blanco-80 anim-pop">{notice}</p>}
      {fallo && <p id="aviso-responsable-error" role="alert" className="mt-4 border-l-4 border-l-mostaza bg-blanco-05 px-3 py-2 text-sm leading-6 text-blanco-80 anim-pop">{fallo}</p>}
    </div>
  );
}
