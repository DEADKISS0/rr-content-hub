'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

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
      <h1 className="font-display text-3xl font-bold uppercase text-blanco">Acceder al hub</h1>
      <p className="mt-3 text-sm text-blanco-60">
        Solo quien tiene una cuenta autorizada puede crear o mover piezas.
      </p>

      {sent ? (
        <div className="brutal-panel mt-8 anim-rise">
          <p className="text-mostaza font-display font-bold">LINK ENVIADO</p>
          <p className="mt-2 text-sm text-blanco-60">
            Revisa tu correo (y la carpeta de spam). El enlace caduca en una hora.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mono-label block text-fucsia">
              TU CORREO
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-2 w-full border-2 border-blanco-30 bg-negro p-3 font-mono text-sm text-blanco placeholder:text-blanco-20 focus:border-fucsia focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-fucsia">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-brutal w-full bg-fucsia text-blanco disabled:opacity-50"
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
            className="btn-brutal w-full border-2 border-blanco-30 bg-transparent text-blanco hover:bg-blanco-05"
          >
            ENTRAR CON GOOGLE
          </button>
        </form>
      )}
    </main>
  );
}
