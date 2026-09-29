'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { entrarConCodigo, type ClienteConCodigo } from '@/lib/hub-client';

/**
 * La puerta del hub: cuatro dígitos y tu nombre.
 *
 * Decisión de Santiago (2026-09-28): fuera el acceso por correo. Wundeer es
 * 1111, Candilejas es 2222, y dentro de cada cliente entras con tu nombre y tu
 * rol de siempre.
 *
 * ⚠️ Historia que no se debe repetir: hubo dos pantallas de acceso en este
 * proyecto. Se escribió una en `src/app/auth/login/` y el middleware seguía
 * apuntando a otra, así que la que el equipo veía no era la que se probaba. Si
 * algún día se escribe otra puerta, hay que cambiar el middleware en el MISMO
 * commit.
 *
 * Decisiones que se tomaron y por qué:
 *
 * - **El código va primero y solo.** Cuatro casillas de un dígito. No hay
 *   "¿se te ha olvidado el código?" porque no hay nada que recordar: es un
 *   número de cuatro cifras que Dirección dice en voz alta.
 *
 * - **El nombre se elige DESPUÉS, de una lista.** La lista sale de la base y
 *   solo tiene a quien tiene acceso a ese cliente. No se puede escribir un
 *   nombre a mano, que es lo que haría que el código no sirviera de nada.
 *
 * - **Por pasos, no todo en una pantalla.** Primero el código, porque es lo que
 *   dice de qué cliente entras. Ver 18 nombres y luego tener que elegir cliente
 *   es preguntarle a alguien que ya sabe la respuesta.
 *
 * - **El código nunca se guarda en el navegador.** Se comprueba en el servidor
 *   y lo que vuelve es el nombre del cliente y su lista de gente, no el código.
 */

export default function LoginPage() {
  return <Formulario />;
}

function Formulario() {
  const router = useRouter();
  const [digitos, setDigitos] = useState(['', '', '', '']);
  const [cliente, setCliente] = useState<ClienteConCodigo | null>(null);
  const [personas, setPersonas] = useState<{ nombre: string; correo: string }[]>([]);
  const [elegido, setElegido] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const codigo = digitos.join('');

  /** Un dígito por casilla. Si se pegan varios, se reparten uno a uno. */
  function poner(indice: number, valor: string) {
    const limpio = valor.replace(/\D/g, '');
    if (limpio.length > 1) {
      const nuevos = [...digitos];
      for (let i = 0; i < limpio.length && indice + i < 4; i += 1) {
        nuevos[indice + i] = limpio[i];
      }
      setDigitos(nuevos);
      return;
    }
    const nuevos = [...digitos];
    nuevos[indice] = limpio;
    setDigitos(nuevos);
  }

  /** Backspace en una casilla vacía vuelve a la anterior y la borra. */
  function atras(indice: number) {
    const nuevos = [...digitos];
    if (digitos[indice] === '' && indice > 0) {
      nuevos[indice - 1] = '';
    } else {
      nuevos[indice] = '';
    }
    setDigitos(nuevos);
  }

  /** El código está completo: se mira qué cliente es. */
  async function buscarCliente() {
    if (codigo.length !== 4) {
      setError('Escribe los cuatro dígitos.');
      return;
    }
    setCargando(true);
    setError('');
    const resultado = await entrarConCodigo(codigo);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      setDigitos(['', '', '', '']);
      return;
    }
    if (!resultado.cliente) {
      setError('Ese código no abre ningún cliente. Pregúntale a Dirección cuál es.');
      setDigitos(['', '', '', '']);
      return;
    }
    if (resultado.personas.length === 0) {
      setError('Ese cliente todavía no tiene a nadie con acceso. Avísale a Dirección.');
      setDigitos(['', '', '', '']);
      return;
    }
    setCliente(resultado.cliente);
    setPersonas(resultado.personas);
    setElegido(resultado.personas[0]?.correo ?? '');
  }

  /** Cliente y persona: se entra. */
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente || !elegido) {
      setError('Elige tu nombre.');
      return;
    }
    setCargando(true);
    setError('');
    const nombre = personas.find((p) => p.correo === elegido)?.nombre ?? '';
    const resultado = await entrarConCodigo(codigo, { correo: elegido, nombre });
    if (!resultado.ok) {
      setCargando(false);
      setError(resultado.error ?? 'No pudimos entrar.');
      return;
    }
    router.push(`/${cliente.slug}`);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl font-bold text-blanco">Acceder al hub</h1>
      <p className="mt-3 text-sm leading-6 text-blanco-60">
        El código del cliente y tu nombre. Sin correos ni contraseñas.
      </p>

      {error && (
        <p role="alert" className="mt-6 border-l-2 border-mostaza bg-mostaza/10 px-4 py-3 text-sm leading-6 text-mostaza">
          {error}
        </p>
      )}

      {!cliente ? (
        <form onSubmit={(e) => { e.preventDefault(); buscarCliente(); }} className="mt-8">
          <fieldset>
            <legend className="mono-label block text-blanco-50">// CÓDIGO DEL CLIENTE</legend>
            <div className="mt-3 flex gap-2">
              {digitos.map((d, i) => (
                <input
                  key={i}
                  value={d}
                  onChange={(e) => poner(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') { e.preventDefault(); atras(i); }
                  }}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={4}
                  autoFocus={i === 0}
                  aria-label={`Dígito ${i + 1} de 4`}
                  className="h-16 w-full border border-blanco-30 bg-negro text-center font-display text-2xl text-blanco focus:border-blanco-60 focus:outline-none"
                />
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={cargando} className="btn-brutal mt-6 w-full disabled:opacity-50">
            {cargando ? 'BUSCANDO…' : 'CONTINUAR'}
          </button>
        </form>
      ) : (
        <form onSubmit={entrar} className="mt-8 space-y-5 anim-rise">
          <div className="brutal-panel">
            <p className="mono-label text-blanco-50">// CLIENTE</p>
            <p className="mt-1 font-display text-2xl font-bold text-blanco">{cliente.nombre}</p>
            <button
              type="button"
              onClick={() => { setCliente(null); setDigitos(['', '', '', '']); setPersonas([]); setError(''); }}
              className="mt-2 font-mono text-[10px] text-blanco-40 underline underline-offset-4 hover:text-blanco-70"
            >
              Cambiar el código
            </button>
          </div>

          <div>
            <label htmlFor="persona" className="mono-label block text-blanco-50">
              // QUIÉN ERES
            </label>
            <select
              id="persona"
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              autoFocus
              className="input-brutal mt-2 w-full"
            >
              {personas.map((p) => (
                <option key={p.correo} value={p.correo}>{p.nombre}</option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-blanco-50">
              Tu rol en este cliente es el de siempre. Si no ves tu nombre, es que no tienes
              acceso todavía: dilo a Dirección.
            </p>
          </div>

          <button type="submit" disabled={cargando} className="btn-brutal w-full disabled:opacity-50">
            {cargando ? 'ENTRANDO…' : 'ENTRAR'}
          </button>
        </form>
      )}
    </main>
  );
}