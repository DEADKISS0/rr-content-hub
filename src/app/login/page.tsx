'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AUTH_ENABLED } from '@/lib/mode';

/**
 * La pantalla de acceso del equipo. Esta es la que ve todo el mundo: el
 * middleware manda aquí, y no hay ninguna otra enlazada.
 *
 * ⚠️ Historia que no se debe repetir (2026-09-28): se escribió una segunda
 * pantalla en `src/app/auth/login/page.tsx` con Google + contraseña, creyendo
 * que era "la" pantalla de login. El middleware nunca se cambió y seguía
 * apuntando a esta. Si algún día se escribe otra, hay que cambiar el middleware
 * en el MISMO commit, o reproducir el mismo bug.
 *
 * UNA sola puerta, y es un código (decisión de Santiago, 2026-09-28): se
 * escribe el correo, le llega un código de un solo uso, y con eso se entra.
 *
 * Por qué sin Google y sin contraseña, y no por capricho:
 *
 * - **Nadie recuerda contraseñas.** El equipo entra una vez y ya no vuelve a
 *   inventar una. Un método que exige recordar algo se abandona.
 *
 * - **El código no se puede robar ni reusar.** Se pide para el correo REAL de
 *   esa persona, así que solo quien tiene ese buzón puede pedirlo. Una
 *   contraseña se filtra, se reutiliza y se acaba en una lista; un código de un
 *   uso caduca en minutos y no sirve para nada más.
 *
 * - **No hay dos caminos que se contradigan.** Antes esta pantalla tenía tres:
 *   Google, contraseña y link. Tres caminos son tres formas de que alguien se
 *   quede afuera sin saber por qué, y fue justo lo que pasó.
 *
 * Lo que el código NO dice: si el correo está o no en la lista del equipo. Se
 * contesta igual a todos, siempre con el mismo texto. Si el código se pide con
 * un correo que no está dado de alta no llega nada, y por tanto no hay forma de
 * averiguar qué correos existen.
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
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // El cliente de Supabase queda solo para VERIFICAR el código. Pedirlo ya no
  // pasa por aquí: eso va por la API del servidor, que es la que consulta la
  // lista blanca antes de pedir nada.
  const supabase = createClient();

  // Si la escritura está apagada, entrar es opcional: el tablero se puede ver
  // igual, pero crear y mover piezas no.
  const soloLectura = !AUTH_ENABLED;

  /**
   * A dónde volver. Sin esto, entrar devolvía a la persona al tablero y perdía
   * el formulario a medio llenar. Solo se aceptan rutas internas: un
   * `?next=https://otro` sería un redirect abierto, y `/\\evil.example` pasa un
   * `startsWith('/')` ingenuo pero el navegador lo resuelve como
   * protocolo-relativo. Se normaliza la barra y se vuelve a comprobar; lo que
   * no sea interno, cae al tablero en vez de inventarse un destino.
   */
  const params = useSearchParams();
  const pedido = params.get('next') ?? '/select-project';
  const normalizado = pedido.replace(/\\/g, '/');
  const destino = normalizado.startsWith('/') && !normalizado.startsWith('//')
    ? normalizado
    : '/select-project';

  // Tres motivos por los que se vuelve aquí, y confundirlos hace que alguien
  // piense que el código está mal cuando el problema es otro:
  //   · `sinAcceso=1`  la cuenta existe pero el correo no está en la lista.
  //   · `error=...`    Supabase rechazó el ingreso.
  //   · `next`         aún no se ha entrado, esto es normal.
  const sinAcceso = params.get('sinAcceso') === '1';
  const errorVuelta = params.get('error');

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('El sistema de acceso no está configurado.');
      return;
    }
    const limpio = email.trim().toLowerCase();
    if (!limpio) {
      setError('Escribí tu correo.');
      return;
    }
    setLoading(true);
    setError('');
    // Va por la API del servidor, no por el cliente de Supabase del navegador:
    // el servidor consulta la lista blanca ANTES de pedir nada, y así pedir el
    // código no crea la cuenta de un correo inventado. Además la respuesta es
    // la misma para todos, para no convertir esta pantalla en un directorio de
    // qué correos están dados de alta.
    const respuesta = await fetch('/api/pedir-codigo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: limpio }),
    });
    setLoading(false);
    if (!respuesta.ok) {
      setError('No pudimos mandarte el código. Escríbele a Dirección.');
      return;
    }
    setSent(true);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('El sistema de acceso no está configurado.');
      return;
    }
    if (!codigo.trim()) {
      setError('Escribí el código que te llegó.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codigo.trim(),
      type: 'email',
    });
    setLoading(false);
    if (err) {
      // No se distingue "código equivocado" de "código vencido": se dice lo
      // mismo para no dar pistas sobre qué códigos existen.
      setError('Ese código no sirve. Revisa el correo y escríbelo tal cual.');
      return;
    }
    router.push(destino);
    router.refresh();
  }

  /** Cambia el correo y vuelve a pedir: el código anterior ya no vale. */
  function cambiarCorreo() {
    setSent(false);
    setCodigo('');
    setError('');
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl font-bold text-blanco">Acceder al hub</h1>
      <p className="mt-3 text-sm leading-6 text-blanco-60">
        Escribe tu correo y te llega un código. No hay contraseña que recordar.
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
          No pudimos completar el ingreso. Pedí un código nuevo y escríbelo tal cual.
        </p>
      )}

      {sent ? (
        <form onSubmit={entrar} className="mt-8 space-y-5">
          <div className="brutal-panel anim-rise">
            <p className="font-display font-bold text-blanco">Código enviado</p>
            <p className="mt-2 text-sm text-blanco-60">
              Va a <b className="font-mono text-blanco">{email.trim().toLowerCase()}</b>. Revisa
              también la carpeta de spam. Caduca en unos minutos.
            </p>
          </div>

          <div>
            <label htmlFor="codigo" className="mono-label block text-blanco-50">
              EL CÓDIGO
            </label>
            <input
              id="codigo"
              // `inputMode` sin `type="number"`: los códigos pueden traer letra
              // y un teclado numérico en el móvil no las tiene.
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="El código que te llegó"
              className="mt-2 w-full border border-blanco-30 bg-negro p-3 font-mono text-sm text-blanco placeholder:text-blanco-20 focus:border-blanco-40 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-mostaza">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-brutal w-full disabled:opacity-50">
            {loading ? 'VERIFICANDO…' : 'ENTRAR'}
          </button>

          <button
            type="button"
            onClick={cambiarCorreo}
            className="w-full pt-2 font-mono text-[10px] text-blanco-40 underline underline-offset-4 hover:text-blanco-70"
          >
            Usar otro correo
          </button>
        </form>
      ) : (
        <form onSubmit={pedirCodigo} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mono-label block text-blanco-50">
              TU CORREO
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-2 w-full border border-blanco-30 bg-negro p-3 font-mono text-sm text-blanco placeholder:text-blanco-20 focus:border-blanco-40 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-mostaza">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-brutal w-full disabled:opacity-50">
            {loading ? 'MANDANDO…' : 'MANDARME EL CÓDIGO'}
          </button>
        </form>
      )}
    </main>
  );
}