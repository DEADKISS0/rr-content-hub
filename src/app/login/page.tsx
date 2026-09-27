'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AUTH_ENABLED } from '@/lib/mode';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  // Si la escritura está apagada, entrar es opcional: el tablero se puede ver
  // igual, pero crear y mover piezas no. Decirlo aquí evita la ronda de
  // "entré y me expulsó", que es lo que pasaba sin este aviso.
  const soloLectura = !AUTH_ENABLED;

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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
