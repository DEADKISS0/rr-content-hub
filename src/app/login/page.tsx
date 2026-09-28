'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AUTH_ENABLED } from '@/lib/mode';

/**
 * La pantalla de acceso del equipo. Esta es la que ve todo el mundo: el
 * middleware manda aquí (`middleware.ts` lo hace en las tres ramas), y no hay
 * ninguna otra enlazada.
 *
 * ⚠️ Historia que no se debe repetir (2026-09-28): se escribió una segunda
 * pantalla en `src/app/auth/login/page.tsx` con Google + contraseña, creyendo
 * que era "la" pantalla de login. El middleware nunca se cambió y seguía
 * apuntando a esta. El equipo aterrizaba en la de aquí, que solo tenía magic
 * link, y la pantalla con contraseña quedaba inalcanzable salvo que alguien
 * escribiera la URL a mano. La puerta que se probaba en el navegador no era la
 * puerta que ve la gente.
 *
 * Por eso ahora NO hay dos pantallas: la de auth/login se borró y esta es la
 * única. Si algún día se escribe otra, hay que cambiar el middleware en el MISMO
 * commit, o reproducir el mismo bug.
 *
 * Tres puertas, como pidió Santiago:
 *
 * 1. **Google** — la que usa el equipo. Devuelve SIEMPRE a `/auth/callback`,
 *    nunca al destino final: el Content Hub y Medellín Guide comparten proyecto
 *    de Supabase y Google, y Supabase solo tiene un destino de respaldo. Por eso
 *    un login sin destino abre Medellín Guide en vez del hub.
 *
 * 2. **Correo y contraseña** — el respaldo. Si el OAuth falla o se queda pegado,
 *    hay una segunda vía que no depende de Google.
 *
 * 3. **Link por correo** — sin contraseña, para quien no la tenga. Llega al
 *    correo real de esa persona, así que no sirve para averiguar qué correos hay
 *    dados de alta.
 */

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-20"><p className="font-mono text-sm text-blanco-50">Cargando…</p></main>}>
      <FormularioLogin />
    </Suspense>
  );
}

function FormularioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
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

  // Tres motivos por los que se vuelve aquí, y confundirlos hace que el equipo
  // piense que la contraseña está mal cuando el problema es otro:
  //   · `sinAcceso=1`  la cuenta existe pero el correo no está en la lista.
  //   · `error=...`    Google o Supabase rechazaron el ingreso.
  //   · `next`         aún no se ha entrado, esto es normal.
  const sinAcceso = params.get('sinAcceso') === '1';
  const errorVuelta = params.get('error');

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
   * Mandar el destino final directamente también falla: si se rechaza, cae
   * igual al SITE_URL equivocado. El callback es la ruta estable.
   */
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;

  async function entrarConClave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('El sistema de acceso no está configurado.');
      return;
    }
    if (!email || !clave) {
      setError('Escribí tu correo y tu contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    });
    setLoading(false);
    if (err) {
      // Genérico a propósito: decir "ese correo no existe" confirmaría qué
      // correos están dados de alta.
      setError('No pude entrar con ese correo y esa contraseña.');
      return;
    }
    router.push(destino);
  }

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
        Acceso para el equipo. Tu correo ya está en la lista, no hay que pedirte registro.
      </p>

      {soloLectura && (
        <p className="mt-4 border-l-2 border-mostaza/70 bg-blanco-05 px-4 py-3 text-sm leading-6 text-blanco-70">
          Ahora mismo el hub está en <b className="text-blanco">modo lectura</b>: puedes mirar todo, pero para crear o mover piezas hay que entrar.
        </p>
      )}

      {sinAcceso && (
        <p role="status" className="mt-6 border-l-2 border-mostaza bg-mostaza/10 px-4 py-3 text-sm leading-6 text-mostaza">
          Tu cuenta está bien, pero ese correo <b className="text-blanco">no está en la lista del equipo</b>. Escríbele a Dirección para que te agreguen.
        </p>
      )}

      {!sinAcceso && errorVuelta && (
        <p role="status" className="mt-6 border-l-2 border-mostaza bg-mostaza/10 px-4 py-3 text-sm leading-6 text-mostaza">
          Google no pudo completar el ingreso. Probá con el correo y la contraseña, o con el link.
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
        <form onSubmit={entrarConClave} className="mt-8 space-y-5">
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

          <div>
            <label htmlFor="clave" className="mono-label block text-blanco-50">
              TU CONTRASEÑA
            </label>
            <input
              id="clave"
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full border border-blanco-30 bg-negro p-3 font-mono text-sm text-blanco placeholder:text-blanco-20 focus:border-blanco-40 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-blanco-60">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-brutal w-full disabled:opacity-50"
          >
            {loading ? 'ENTRANDO…' : 'ENTRAR'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-blanco-20" />
            <span className="font-mono text-[10px] text-blanco-40">O CON GOOGLE</span>
            <div className="h-px flex-1 bg-blanco-20" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="btn-brutal w-full bg-transparent text-blanco-70 hover:text-blanco hover:bg-blanco-05"
          >
            Entrar con Google
          </button>

          <button
            type="button"
            onClick={sendLink}
            disabled={loading}
            className="w-full pt-2 font-mono text-[10px] text-blanco-40 underline underline-offset-4 hover:text-blanco-70"
          >
            ¿No recuerdas la contraseña? Recibe un link por correo
          </button>
        </form>
      )}
    </main>
  );
}
