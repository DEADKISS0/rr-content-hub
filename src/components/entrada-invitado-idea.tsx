'use client';

import { useEffect, useState } from 'react';
import { guardarPerfil } from '@/lib/perfil-votante';

type NombreRegistrado = { id: string; nombre: string };

/**
 * Pedir con qué nombre se sube la idea.
 *
 * El resto del hub se recorre sin puerta. Aquí, y solo aquí, hace falta decir
 * quién eres: un nombre nuevo o uno de los ya registrados. No hay código de
 * cliente ni registro con correo.
 */
export function EntradaInvitadoIdea({
  projectSlug,
  abierto,
  onCerrar,
  onListo,
}: {
  projectSlug: string;
  abierto: boolean;
  onCerrar: () => void;
  onListo: (quien: { nombre: string; email: string }) => void;
}) {
  const [nombres, setNombres] = useState<NombreRegistrado[]>([]);
  const [escrito, setEscrito] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setCargandoLista(true);
    setAviso('');
    fetch('/api/identidad')
      .then((r) => r.json())
      .then((data: { nombres?: NombreRegistrado[] }) => {
        if (!cancelado) setNombres(Array.isArray(data.nombres) ? data.nombres : []);
      })
      .catch(() => {
        if (!cancelado) setAviso('No se pudieron cargar los nombres registrados. Puedes escribir el tuyo.');
      })
      .finally(() => {
        if (!cancelado) setCargandoLista(false);
      });
    return () => { cancelado = true; };
  }, [abierto]);

  if (!abierto) return null;

  async function entrar(cuerpo: { perfilId?: string; nombre?: string }) {
    if (guardando) return;
    setGuardando(true);
    setAviso('');
    try {
      const res = await fetch('/api/identidad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectSlug, ...cuerpo }),
      });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        nombre?: string;
        email?: string;
        coincidencias?: NombreRegistrado[];
      };
      if (res.status === 409 && data.coincidencias?.length) {
        setNombres((prev) => {
          const visto = new Set(prev.map((n) => n.id));
          return [...prev, ...data.coincidencias!.filter((c) => !visto.has(c.id))];
        });
        setAviso(data.error ?? 'Ese nombre ya está registrado. Elígelo en la lista.');
        setGuardando(false);
        return;
      }
      if (!res.ok || !data.nombre || !data.email) {
        setAviso(data.error ?? 'No se pudo entrar con ese nombre.');
        setGuardando(false);
        return;
      }
      guardarPerfil({ email: data.email, nombre: data.nombre });
      onListo({ nombre: data.nombre, email: data.email });
    } catch {
      setAviso('No se pudo entrar con ese nombre.');
    }
    setGuardando(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-entrada-idea"
    >
      <div className="w-full max-w-md border border-blanco-20 bg-black p-6 text-blanco">
        <p className="eyebrow text-blanco-50">[QUIÉN ERES]</p>
        <h2 id="titulo-entrada-idea" className="mt-3 font-display text-2xl font-bold">
          Entra como invitado para subir la idea
        </h2>
        <p className="mt-3 text-sm leading-6 text-blanco-70">
          Escribe tu nombre o elige uno de los ya registrados. No hace falta correo ni código.
        </p>

        {aviso ? (
          <p className="mt-4 border border-amarillo/40 bg-amarillo/10 px-3 py-2 font-mono text-xs text-amarillo" role="alert">
            {aviso}
          </p>
        ) : null}

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar({ nombre: escrito });
          }}
        >
          <label htmlFor="nombre-invitado" className="font-mono text-[10px] text-blanco-50">
            TU NOMBRE
          </label>
          <input
            id="nombre-invitado"
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            autoComplete="name"
            className="mt-1 w-full border border-blanco-20 bg-transparent px-3 py-2 text-sm text-blanco"
            placeholder="Cómo te llamas"
            disabled={guardando}
          />
          <button type="submit" className="btn-brutal mt-3 w-full" disabled={guardando || escrito.trim().length < 2}>
            {guardando ? 'ENTRANDO…' : 'ENTRAR CON ESTE NOMBRE'}
          </button>
        </form>

        <div className="mt-6 border-t border-blanco-10 pt-4">
          <p className="font-mono text-[10px] text-blanco-50">NOMBRES YA REGISTRADOS</p>
          {cargandoLista ? (
            <p className="mt-2 text-sm text-blanco-50">Cargando…</p>
          ) : nombres.length === 0 ? (
            <p className="mt-2 text-sm text-blanco-50">Aún no hay nombres. Escribe el tuyo arriba.</p>
          ) : (
            <ul className="mt-2 max-h-48 overflow-y-auto">
              {nombres.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center border-b border-blanco-10 px-2 text-left text-sm text-blanco hover:bg-blanco-10"
                    disabled={guardando}
                    onClick={() => void entrar({ perfilId: n.id })}
                  >
                    {n.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="mt-5 font-mono text-[10px] text-blanco-50 underline underline-offset-4 hover:text-blanco"
          onClick={onCerrar}
          disabled={guardando}
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
}
