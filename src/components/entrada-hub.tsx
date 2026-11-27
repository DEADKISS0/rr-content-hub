'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { guardarPerfil } from '@/lib/perfil-votante';

type Cliente = { slug: string; nombre: string };

/**
 * Registro rápido e invitado, en la misma página.
 *
 * No hay enlace a Google ni a otra origen. El formulario hace fetch a
 * `/api/cuenta` y, si sale bien, la cookie queda puesta y la barra se
 * actualiza con `router.refresh()` (vuelve a pedir los datos al servidor
 * sin recargar el documento).
 */
export function EntradaHub({
  proyecto,
  clientes,
}: {
  proyecto?: string | null;
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<'registro' | 'invitado' | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [cliente, setCliente] = useState(proyecto || clientes[0]?.slug || '');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState('');

  async function enviar(modo: 'registro' | 'invitado') {
    if (ocupado) return;
    setAviso('');
    setOcupado(true);
    const respuesta = await fetch('/api/cuenta', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modo,
        nombre,
        correo: modo === 'registro' ? correo : undefined,
        proyecto: cliente,
      }),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: string;
      nombre?: string;
      email?: string;
      modo?: string;
    } | null;
    setOcupado(false);
    if (!respuesta.ok || !cuerpo?.email || !cuerpo.nombre) {
      setAviso(cuerpo?.error ?? 'No se pudo entrar.');
      return;
    }
    if (modo === 'registro') {
      guardarPerfil({ email: cuerpo.email, nombre: cuerpo.nombre });
    }
    setListo(modo === 'invitado' ? `Entraste como ${cuerpo.nombre}.` : `Perfil listo: ${cuerpo.nombre}.`);
    setAbierto(null);
    window.dispatchEvent(new Event('rr-hub-sesion'));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="entrada-hub">
      <button
        type="button"
        data-testid="entrada-registro"
        onClick={() => { setAbierto('registro'); setAviso(''); }}
        className="inline-flex min-h-[44px] items-center border border-blanco-40 px-3 font-mono text-[10px] text-blanco hover:border-blanco"
      >
        REGISTRO RÁPIDO
      </button>
      <button
        type="button"
        data-testid="entrada-invitado"
        onClick={() => { setAbierto('invitado'); setAviso(''); }}
        className="inline-flex min-h-[44px] items-center border border-blanco-20 px-3 font-mono text-[10px] text-blanco-70 hover:border-blanco-40"
      >
        ENTRAR COMO INVITADO
      </button>
      {listo && (
        <p data-testid="entrada-ok" className="font-mono text-[10px] text-mostaza" role="status">
          {listo}
        </p>
      )}

      {abierto && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-negro/80 p-4"
          role="presentation"
          onClick={() => { if (!ocupado) setAbierto(null); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="entrada-titulo"
            data-testid="entrada-dialogo"
            className="w-full max-w-md border border-blanco-20 bg-negro p-6"
            onClick={(evento) => evento.stopPropagation()}
            onSubmit={(evento) => {
              evento.preventDefault();
              void enviar(abierto);
            }}
          >
            <h2 id="entrada-titulo" className="font-display text-2xl font-bold text-blanco">
              {abierto === 'registro' ? 'Registro rápido' : 'Modo invitado'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-blanco-60">
              {abierto === 'registro'
                ? 'Se crea tu perfil ahora, en este cliente, y sigues en esta página. No se envía ningún correo.'
                : 'Entras a leer, con un perfil de invitado guardado en la base. No se envía ningún correo.'}
            </p>

            <label className="mt-5 block">
              <span className="mono-label mb-2 block text-blanco-50">// NOMBRE</span>
              <input
                data-testid="registro-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                className="input-brutal w-full"
                maxLength={80}
                autoComplete="name"
                required={abierto === 'registro'}
              />
            </label>

            {abierto === 'registro' && (
              <label className="mt-4 block">
                <span className="mono-label mb-2 block text-blanco-50">// CORREO</span>
                <input
                  data-testid="registro-correo"
                  type="email"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                  className="input-brutal w-full"
                  maxLength={200}
                  autoComplete="email"
                  required
                />
              </label>
            )}

            <label className="mt-4 block">
              <span className="mono-label mb-2 block text-blanco-50">// CLIENTE</span>
              <select
                data-testid="registro-cliente"
                value={cliente}
                onChange={(evento) => setCliente(evento.target.value)}
                className="input-brutal w-full"
              >
                {clientes.map((opcion) => (
                  <option key={opcion.slug} value={opcion.slug}>{opcion.nombre}</option>
                ))}
              </select>
            </label>

            {aviso && (
              <p role="alert" data-testid="entrada-error" className="mt-4 border-l-4 border-l-mostaza px-3 py-2 text-sm text-blanco">
                {aviso}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                data-testid={abierto === 'registro' ? 'registro-enviar' : 'invitado-entrar'}
                disabled={ocupado}
                className="btn-brutal disabled:opacity-50"
              >
                {ocupado ? 'GUARDANDO…' : abierto === 'registro' ? 'CREAR PERFIL' : 'ENTRAR'}
              </button>
              <button
                type="button"
                onClick={() => setAbierto(null)}
                className="btn-ghost"
                disabled={ocupado}
              >
                CERRAR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
