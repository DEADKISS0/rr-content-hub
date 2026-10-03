/**
 * La pantalla sin conexion.
 *
 * Existe para que la PWA tenga algo que abrir cuando no hay red, y no un error
 * blanco. `public/sw.js` la guarda en cada navegacion correcta y la devuelve
 * cuando la peticion falla.
 *
 * OJO CON LA COPIA: esta pagina se sirve DESDE LA CACHE, asi que no puede
 * depender de la base ni de ninguna peticion. Es texto y un boton de recargar, y
 * nada mas. Si anadies un `getIdeas()` aqui, en modo offline el usuario veria un
 * error en vez de la pantalla.
 */
import Link from 'next/link';

export const metadata = { title: 'Sin conexión — RR Content Hub' };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-20">
      <p className="mb-8 flex items-center gap-2.5">
        <span aria-hidden="true" className="block h-6 w-6 bg-fucsia" />
        <span className="font-display text-sm font-bold tracking-[0.28em] text-blanco">RR ALIADOS</span>
      </p>

      <h1 className="font-display text-3xl font-bold text-blanco">Sin conexión</h1>
      <p className="mt-3 text-sm leading-6 text-blanco-60">
        El hub necesita internet: las ideas, los votos y las referencias están vivos en la base.
        En cuanto vuelva, esta pantalla desaparece sola.
      </p>

      <p className="mono-label mt-10 text-blanco-50">// QUÉ PUEDES HACER</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-blanco-60">
        <li>Comprobar la conexión y volver a entrar.</li>
        <li>
          <Link href="/select-project" className="text-mostaza underline">
            Ir al catálogo
          </Link>{' '}
          para cambiar de cliente.
        </li>
      </ul>

      {/* Un formulario a la misma ruta, no un `onClick`: recargar con GET es lo
          unico que funciona cuando la pagina se ha servido desde la cache y el
          boton es un `<form>` de verdad. Un boton de React necesitaria JS, y
          este es justamente el caso sin JS. */}
      <form action="/wundeer" className="mt-8 w-full">
        <button type="submit" className="btn-brutal w-full">
          RECARGAR
        </button>
      </form>
    </main>
  );
}
