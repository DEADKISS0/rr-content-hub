'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { entrarConCodigo, type ClienteConCodigo } from '@/lib/hub-client';
import { Icon } from '@/components/ui/icons';

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

/**
 * Las puertas, con su código, para que un clic lo escriba.
 *
 * El código viaja al navegador porque sin él no se puede rellenar, y porque no
 * es una credencial: es un separador de clientes, y lo que protege de verdad es
 * la fila de `rr_hub_access`, que se comprueba en el servidor. Aun así no se
 * pinta en el texto del botón — el número se ve en las casillas, que es donde
 * toca. Antes había una lista que lo imprimía entero debajo del formulario.
 *
 * Añadir un cliente es añadir una línea aquí Y darle su código en
 * `rr_hub_projects.clave_codigo`. Nada más: la puerta, el selector y la lista
 * del selector salen de ahí.
 */
const PUERTAS = [
  { slug: 'wundeer', nombre: 'WUNDEER', color: '#be076d', codigo: '1111' },
  { slug: 'candilejas', nombre: 'CANDILEJAS', color: '#ded116', codigo: '2222' },
] as const;

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
  // Las cuatro casillas, para poder mover el foco al escribir o al pegar.
  const casillas = useRef<(HTMLInputElement | null)[]>([]);

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
      // Pegado o tecleo rápido: el foco va a donde toca, para no tener que
      // tabular entre las cuatro casillas con el dedo.
      casillas.current[Math.min(indice + limpio.length, 3)]?.focus();
      return;
    }
    const nuevos = [...digitos];
    nuevos[indice] = limpio;
    setDigitos(nuevos);
    // Con el dígito puesto, se salta a la siguiente. Y si ya no queda ninguna,
    // el foco se queda en la última para que Enter sí sirva.
    if (limpio) casillas.current[Math.min(indice + 1, 3)]?.focus();
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

  /**
   * Un clic y el código queda escrito. Pedido el 2026-09-29: teclear cuatro
   * dígitos en cuatro casillas es tedioso y lento, y la puerta es lo primero
   * que ve el equipo cada mañana.
   *
   * Los botones NO llevan el número en el texto que se ve: llevan el nombre del
   * cliente y un punto de su color. El código se escribe en las casillas y ya
   * está, sin que quede escrito en la pantalla. Antes, debajo del formulario,
   * había una lista que imprimía los dos códigos a la vista; eso se quitó.
   *
   * Importante: el botón no entra. Solo rellena. La persona sigue eligiendo su
   * nombre a continuación, porque el código dice de qué cliente entras pero no
   * quién eres — eso lo decide la fila de acceso, en el servidor.
   */
  function rellenar(codigoCliente: string) {
    setDigitos(codigoCliente.split('').slice(0, 4));
    setError('');
    setCliente(null);
    setPersonas([]);
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
      {/*
        La familia visual (Santiago, 2026-09-30). Esta puerta y la del Centro de
        Mando se tienen que reconocer: mismo logo, misma marca de RR, mismo
        negro. Lo que cambia es el cómo se entra — aquí un código de cuatro
        cifras y un nombre, allí Google — y eso no debe romper la familia.
      */}
      <p className="mb-8 flex items-center gap-2.5" aria-label="RR Aliados">
        <span aria-hidden="true" className="block h-6 w-6 bg-fucsia" />
        <span className="font-display text-sm font-bold tracking-[0.28em] text-blanco">RR ALIADOS</span>
      </p>

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
                  ref={(el) => { casillas.current[i] = el; }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') { e.preventDefault(); atras(i); }
                  }}
                  onPaste={(e) => {
                    // Pegar el código entero tiene que funcionar: se reparte solo.
                    const pegado = e.clipboardData.getData('text').replace(/\D/g, '');
                    if (pegado.length > 1) {
                      e.preventDefault();
                      setDigitos(pegado.split('').slice(0, 4));
                      casillas.current[Math.min(pegado.length, 4) - 1]?.focus();
                    }
                  }}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
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

      {!cliente && (
        /* Un botón por cliente y el código se escribe solo. Antes esto era una
           lista que imprimía los dos números a la vista; Santiago lo pidió
           cambiado el 2026-09-29 por dos cosas: que se pudiera hacer con un
           clic, y que el número no quedara escrito en la pantalla.

           Lo que hace el botón es rellenar las casillas, NO entrar. La persona
           sigue eligiendo su nombre después, que es donde se decide qué puede
           hacer. Si el botón entrara directamente, bastaría con que alguien
           suelde el móvil en la mesa para que otro entre con el nombre de otro.

           Y el código no aparece en el texto del botón, solo el nombre del
           cliente y su punto de color. El número se ve en las casillas, que es
           donde toca. */
        <div className="mt-12 border-t border-blanco-20 pt-6">
          <p className="mono-label text-blanco-50">// ¿A QUÉ CLIENTE ENTRAS?</p>
          <div className="mt-3 grid gap-px bg-blanco-10 sm:grid-cols-2">
            {PUERTAS.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => rellenar(item.codigo)}
                className="group flex items-center gap-3 bg-negro px-4 py-4 text-left transition-colors hover:bg-blanco-05"
                aria-label={`Escribir el código de ${item.nombre}`}
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 border border-blanco-40 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: item.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs tracking-[0.08em] text-blanco">
                    {item.nombre}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-blanco-50">
                    UN CLIC · ESCRIBE EL CÓDIGO
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-blanco-40">
                  <Icon name="arrow" size={14} />
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-blanco-50">
            El código abre el cliente. Lo que puedes hacer dentro lo decide tu rol, y ese
            no cambia con el código.
          </p>
        </div>
      )}

      {/* LA SALIDA QUE FALTA (Santiago, 2026-09-30).
          Este archivo era un CALLEJON SIN SALIDA: sin enlaces. Cuando la PWA se
          abre desde la pantalla de inicio, `start_url` es `/wundeer`, el proxy la
          manda a `/login`, y desde ahi no se podia volver a la portada ni abrir la
          puerta de otra forma. La app se quedaba "atascada en el login" sin
          motivo.

          Con esto, quien llegue por la app puede volver a la portada y empezar de
          cero. La portada es publica a proposito: es donde se elige cliente. */}
      <div className="mt-10 border-t border-blanco-10 pt-7">
        <p className="mono-label text-blanco-50">[¿NO ES TU CLIENTE?]</p>
        <Link href="/" className="btn-brutal mt-4 w-full">
          VOLVER A LA PORTADA
        </Link>
        <p className="mt-3 text-xs leading-5 text-blanco-50">
          Ver los proyectos de RR y entrar por otro cliente.
        </p>
      </div>

    </main>
  );
}
