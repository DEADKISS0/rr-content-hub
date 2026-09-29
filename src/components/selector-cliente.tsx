'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icons';

/**
 * Selector de cliente, dentro del hub.
 *
 * Por qué existe: cada código abre un solo cliente, así que hasta el 2026-09-29
 * la única forma de pasar de Wundeer a Candilejas era cerrar sesión y teclear el
 * otro código. La página `/select-project` no ayudaba: leía `projects[0]`, o sea
 * el cliente que ya tenías abierto, y por eso se llamaba a sí misma "ESPACIO
 * ÚNICO" y no había nada que pulsar.
 *
 * Qué decide el servidor: esta lista la pinta el servidor, pero al pulsar se
 * llama a `POST /api/cambiar-cliente`, que **vuelve a comprobar** la fila en
 * `rr_hub_access` antes de firmar la cookie nueva. Que haya un botón en pantalla
 * no concede nada. Y el rol se resuelve entero otra vez: puedes ser `owner` en un
 * cliente y `client_viewer` en el otro, y al cambiar te queda el que tienes ahí.
 *
 * Por qué se ven también los que NO puedes abrir: lo pidió Santiago. Mostrar solo
 * los que puedes abrir esconde que el otro cliente existe; mostrarlo todo sin
 * decir nada invita a pulsar donde no se puede. Con candado y sin enlace, se ve
 * que existe y se sabe que no es tuyo.
 *
 * El candado NO es "próximamente": Satiro y Boga existen en la base con sus
 * accesos, pero no tienen código de cuatro dígitos, así que no hay puerta por la
 * que entrar. En cuanto tengan, se añaden a `CLIENTES_CONOCIDOS` y este
 * componente los abre sin tocar nada.
 */
export type ClienteParaPintar = {
  slug: string;
  name: string;
  client_name: string;
  brand_primary_color: string | null;
  description: string | null;
  /** Solo en los abiertos: el rol que la persona tiene en ese cliente. */
  rol?: string;
};

const ETIQUETA_ROL: Record<string, string> = {
  owner: 'DIRECCIÓN', creator: 'CREATIVA', editor: 'EDITOR', camera: 'CÁMARA',
  model: 'MODELO', publisher: 'PUBLICACIÓN', media_buyer: 'PAUTA',
  client_approver: 'CLIENTE', client_viewer: 'CLIENTE · LECTURA', sin_rol: 'SIN ROL',
};

export function SelectorCliente({
  actual,
  abiertos,
  cerrados,
  compacto = false,
}: {
  actual: string;
  abiertos: ClienteParaPintar[];
  cerrados: ClienteParaPintar[];
  compacto?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // Cierra con Escape y con un clic fuera. Sin esto el desplegable se queda
  // pegado y tapa el tablero, que es el defecto que ya se corrigió dos veces en
  // la guía guiada.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const cambiar = useCallback(
    async (slug: string, nombre: string) => {
      if (cambiando || slug === actual) {
        setAbierto(false);
        return;
      }
      setCambiando(slug);
      setAviso('');

      try {
        const respuesta = await fetch('/api/cambiar-cliente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proyecto: slug }),
        });
        const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string } | null;

        if (!respuesta.ok) {
          // El aviso va junto al desplegable y con su motivo: un fallo que no se
          // ve es un silencio, y esta es la acción que la gente va a pulsar.
          setAviso(cuerpo?.error ?? `No se pudo cambiar a ${nombre} (${respuesta.status}).`);
          setCambiando(null);
          return;
        }

        // `replace` y no `push`: cambiar de cliente no es "ir a otra página", es
        // seguir en la misma. Con `push`, el botón "atrás" del navegador
        // devolvería al cliente anterior con la cookie ya cambiada, y el tablero
        // pediría un cliente al que la sesión ya no tiene acceso.
        setAbierto(false);
        router.replace(`/${slug}`);
        router.refresh();
      } catch {
        setAviso('No se pudo contactar al servidor. Revisa la conexión e inténtalo otra vez.');
        setCambiando(null);
      }
    },
    [actual, cambiando, router],
  );

  const actualData = abiertos.find((c) => c.slug === actual) ?? cerrados.find((c) => c.slug === actual);
  const color = actualData?.brand_primary_color ?? null;

  return (
    <div className="relative" ref={caja} data-guia="selector-cliente">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-label={`Cliente: ${actualData?.name ?? actual}. Cambiar de cliente`}
        title="Cambiar de cliente"
        className={`group flex w-full items-center gap-2 border border-blanco-20 px-3 py-2 text-left transition-colors hover:border-blanco-40 ${compacto ? 'justify-center' : ''}`}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 border border-blanco-40"
          style={color ? { backgroundColor: color } : undefined}
        />
        <span className={`min-w-0 flex-1 ${compacto ? 'sr-only' : ''}`}>
          <span className="block truncate font-mono text-[10px] tracking-[0.08em] text-blanco">
            {(actualData?.name ?? actual).toUpperCase()}
          </span>
          {!compacto && (
            <span className="block truncate font-mono text-[10px] text-blanco-50">
              {abiertos.length > 1 ? `${abiertos.length} CLIENTES · CAMBIAR` : '1 CLIENTE'}
            </span>
          )}
        </span>
        <Icon name={abierto ? 'close' : 'arrow'} size={13} />
      </button>

      {abierto && (
        <div
          role="listbox"
          aria-label="Clientes"
          className="absolute left-0 z-50 mt-1 w-72 border border-blanco-20 bg-negro p-2 shadow-[0_18px_40px_rgba(0,0,0,0.55)] anim-rise"
        >
          {abiertos.map((cliente) => {
            const esActual = cliente.slug === actual;
            return (
              <button
                key={cliente.slug}
                type="button"
                role="option"
                aria-selected={esActual}
                disabled={esActual || cambiando !== null}
                onClick={() => void cambiar(cliente.slug, cliente.name)}
                className={`flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${
                  esActual
                    ? 'cursor-default border-l-blanco bg-blanco-10'
                    : 'border-l-transparent hover:border-l-blanco-40 hover:bg-blanco-05'
                } disabled:opacity-100`}
              >
                <span
                  aria-hidden="true"
                  className="mt-1 h-3 w-3 shrink-0 border border-blanco-40"
                  style={cliente.brand_primary_color ? { backgroundColor: cliente.brand_primary_color } : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[10px] tracking-[0.08em] text-blanco">
                    {cliente.name.toUpperCase()}
                  </span>
                  {cliente.description && (
                    <span className="mt-1 block text-[10px] leading-4 text-blanco-50">{cliente.description}</span>
                  )}
                  <span className="mt-1 block font-mono text-[10px] text-blanco-40">
                    {ETIQUETA_ROL[cliente.rol ?? ''] ?? (cliente.rol ?? '').toUpperCase()}
                  </span>
                </span>
                {esActual && <span className="mt-0.5 shrink-0 font-mono text-[10px] text-blanco-50">AQUÍ</span>}
                {!esActual && cambiando === cliente.slug && (
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-mostaza">ABRIENDO…</span>
                )}
              </button>
            );
          })}

          {cerrados.length > 0 && (
            <>
              <p className="mt-2 border-t border-blanco-10 px-3 pt-2 font-mono text-[10px] text-blanco-40">
                SIN ACCESO
              </p>
              {cerrados.map((cliente) => (
                <div
                  key={cliente.slug}
                  aria-disabled="true"
                  className="flex items-start gap-3 border-l-2 border-l-transparent px-3 py-2.5 opacity-55"
                >
                  <span aria-hidden="true" className="mt-1 shrink-0 text-blanco-40">
                    <Icon name="lock" size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[10px] tracking-[0.08em] text-blanco-60">
                      {cliente.name.toUpperCase()}
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-blanco-40">
                      Tu correo no tiene acceso. Pídeselo a quien administra el hub.
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}

          {aviso && (
            <p role="alert" className="mt-2 border-l-4 border-l-mostaza bg-blanco-05 px-3 py-2 text-[10px] leading-4 text-mostaza">
              {aviso}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
