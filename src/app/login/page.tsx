'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AUTH_ENABLED } from '@/lib/mode';

/**
 * `useSearchParams` obliga a que la página se renderice en cliente, así que
 * Next exige un `<Suspense>` alrededor. Sin él, `/login` da error de build: es
 * la razón por la que la página no podía leer a dónde volver.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-20"><p className="font-mono text-sm text-blanco-50">Cargando…</p></main>}>
      <FormularioLogin />
    </Suspense>
  );
}

function FormularioLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  // Si la escritura está apagada, entrar es opcional: el tablero se puede ver
  // igual, pero crear y mover piezas no. Decirlo aquí evita la ronda de
  // "entré y me expulsó", que es lo que pasaba sin este aviso.
  const soloLectura = !AUTH_ENABLED;

  /**
   * A dónde volver. Sin esto, entrar devolvía a la persona al tablero y perdía
   * el formulario a medio llenar: la razón de que la gate de auth se sintiera
   * como un callejón. Solo se aceptan rutas internas — un `?next=https://otro`
   * sería un redirect abierto.
   */
  const params = useSearchParams();
  const pedido = params.get('next') ?? '/select-project';
  const destino = pedido.startsWith('/') && !pedido.startsWith('//') ? pedido : '/select-project';

  /**
   * Dónde aterriza OAuth. SIEMPRE el callback, que ya sabe a dónde mandarle a
   * esta persona, y no el destino final.
   *
   * Por qué importa tanto: el Content Hub y Medellín Guide comparten proyecto
   * de Supabase y cliente de Google. Supabase solo tiene UN destino de
   * respaldo (su SITE_URL, que es el de la app que configuró el proyecto), así
   * que si el login se pide sin `redirectTo`, Google devuelve a la otra
   * aplicación — de eso venía "entro al hub y me abre Medellín Under".
   *
   * Probado: `authorize` sin destino manda `redirect_to` VACÍO a Google, y
   * entonces manda el SITE_URL, que es único para las dos apps. Por eso el
   * destino no puede faltar nunca, ni aunque se pierda el estado.
   *
   * Mandar el destino final directamente también falla: si se rechaza, cae
   * igual al SITE_URL equivocado. El callback es la ruta estable.
   */
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('El sistema de acceso no está configurado.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setError('El sistema de acceso no está configurado.');
      return;
    }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback() },
    });
    if (err) setError(err.message);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl font-bold text-blanco">Acceder al hub</h1>
      <p className="mt-3 text-sm leading-6 text-blanco-60">
        Quien tiene una cuenta autorizada puede crear y mover piezas. El tablero se puede ver sin entrar.
      </p>

      {soloLectura && (
        <p className="mt-4 border-l-2 border-mostaza/70 bg-blanco-05 px-4 py-3 text-sm leading-6 text-blanco-70">
          Ahora mismo el hub está en <b className="text-blanco">modo lectura</b>: puedes mirar todo, pero para crear o mover piezas hay que entrar.
        </p>
      )}

      {sent ? (
        <div className="brutal-panel mt-8 anim-rise">
          <p className="font-display font-bold text-blanco">Link enviado</p>
          <p className="mt-2 text-sm text-blanco-60">
            Revisa tu correo (y la carpeta de spam). El enlace caduca en una hora.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mono-label block text-blanco-50">
              TU CORREO
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-2 w-full border border-blanco-30 bg-negro p-3 font-mono text-sm text-blanco placeholder:text-blanco-20 focus:border-blanco-40 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-blanco-60">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-brutal w-full disabled:opacity-50"
          >
            {loading ? 'ENVIANDO…' : 'ENVIAR LINK DE ACCESO'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-blanco-20" />
            <span className="font-mono text-[10px] text-blanco-40">O</span>
            <div className="h-px flex-1 bg-blanco-20" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="btn-brutal w-full bg-transparent text-blanco-70 hover:text-blanco hover:bg-blanco-05"
          >
            Entrar con Google
          </button>
        </form>
      )}
    </main>
  );
}
