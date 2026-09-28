'use client';

/**
 * Pantalla de acceso del equipo.
 *
 * Dos puertas, como pidió Santiago (2026-09-28):
 *
 * 1. **Google** — entra con la cuenta de correo que ya está en `rr_hub_profiles`.
 *    Es la vía que usa el equipo hoy. OAuth devuelve SIEMPRE a `/auth/callback`,
 *    nunca a la página final, porque el Content Hub y Medellín Guide comparten
 *    proyecto de Supabase y un solo destino de respaldo.
 *
 * 2. **Correo y contraseña** — el respaldo. Si el OAuth falla o se queda pegado
 *    en el Google's consent, hay una segunda puerta que no depende de Google.
 *
 * Por qué existe la segunda: el 2026-09-27 el OAuth de este proyecto ya abrió
 * Medellín Guide en vez del hub, y esa falla no la arregla código: hay que tocar
 * el panel de Google. Con una segunda vía, ese día el equipo sigue entrando.
 *
 * El correo NO se manda al servidor de la app para "comprobar que existe": el
 * login es de Supabase y él solo devuelve un error genérico, que además no
 * revela si ese correo está en la lista. La lista blanca se aplica al voto y al
 * crear, en el servidor.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DESTINO = '/wundeer/ideas/nueva';

export default function PaginaLogin() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrarConGoogle() {
    setOcupado(true);
    setMensaje('');
    const supabase = createClient();
    // `createClient` devuelve null cuando faltan las variables publicas. Sin este
    // chequeo, TypeScript obliga a comprobarlo y un `null` sin avisar deja al
    // equipo mirando un boton que no hace nada.
    if (!supabase) {
      setMensaje('El acceso no está configurado en este despliegue. Escríbele a Dirección.');
      setOcupado(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // `next` viaja en la URL y lo lee el callback. Sin esto, Google vuelve
        // al SITE_URL de Supabase, que puede ser el de la otra aplicación.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(DESTINO)}`,
      },
    });
    if (error) {
      setMensaje(`Google no respondió: ${error.message}. Usá el correo y la contraseña.`);
      setOcupado(false);
    }
    // Sin error, Google redirige: no hay nada que hacer aquí.
  }

  async function entrarConCorreo(evento: FormEvent) {
    evento.preventDefault();
    if (!correo || !clave) {
      setMensaje('Escribí tu correo y tu contraseña.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    const supabase = createClient();
    if (!supabase) {
      setMensaje('El acceso no está configurado en este despliegue. Escríbele a Dirección.');
      setOcupado(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error) {
      // El mensaje va genérico a propósito: decir "ese correo no existe"
      // confirmaría qué correos están dados de alta.
      setMensaje('No pude entrar con ese correo y esa contraseña.');
      setOcupado(false);
      return;
    }
    router.push(DESTINO);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[10px] tracking-[0.2em] text-mostaza">RR ALIADOS · CONTENT HUB</p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-blanco">Entrar</h1>
        <p className="font-mono text-xs leading-5 text-blanco-60">
          Acceso para el equipo. Tu correo ya está en la lista, no hay que pedirte registro.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={entrarConGoogle}
          disabled={ocupado}
          className="btn-brutal disabled:opacity-50"
        >
          {ocupado ? 'ABRIENDO GOOGLE…' : 'ENTRAR CON GOOGLE'}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-blanco-20" />
          <span className="font-mono text-[10px] text-blanco-40">O CON CORREO</span>
          <span className="h-px flex-1 bg-blanco-20" />
        </div>

        <form onSubmit={entrarConCorreo} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-blanco-60">// CORREO</span>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="email"
              placeholder="tucorreo@rraliados.com"
              className="border-2 border-blanco-20 bg-negro px-3 py-3 font-mono text-sm text-blanco outline-none focus:border-fucsia"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-blanco-60">// CONTRASEÑA</span>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="current-password"
              className="border-2 border-blanco-20 bg-negro px-3 py-3 font-mono text-sm text-blanco outline-none focus:border-fucsia"
            />
          </label>
          <button type="submit" disabled={ocupado} className="btn-brutal disabled:opacity-50">
            {ocupado ? 'ENTRANDO…' : 'ENTRAR'}
          </button>
        </form>
      </section>

      {mensaje ? (
        <p role="status" className="border-l-2 border-mostaza bg-mostaza/10 px-4 py-3 font-mono text-[11px] leading-5 text-mostaza">
          {mensaje}
        </p>
      ) : null}

      <footer className="border-t-2 border-blanco-20 pt-5">
        <p className="font-mono text-[10px] leading-5 text-blanco-40">
          Si tu correo no es el que tienes en el hub, escríbele a Dirección. La lista es del
          equipo, no abierta.
        </p>
      </footer>
    </main>
  );
}
