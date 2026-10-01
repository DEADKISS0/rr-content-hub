import Link from 'next/link';

/**
 * El 404 del hub, y por qué existe.
 *
 * Santiago, 2026-10-01: "es como si se hubiera borrado el cliente wundeer, no me
 * digas que lo estás cargando en candilejas". No se había borrado nada: el enlace
 * llevaba el proyecto escrito con una letra de menos (`wunder`), Next devolvió su
 * 404 genérico, y esa pantalla no tiene ni menú ni botón de volver. Es un
 * callejón sin salida: quien llega ahí no sabe si el cliente se fue, si el link
 * está mal escrito o si perdió el acceso, y no puede averiguarlo.
 *
 * Un 404 sin salida es PEOR que un 404, porque convierte un error de tecleo en un
 * misterio. Esta pantalla hace tres cosas para que no vuelva a pasar:
 *
 * 1. Dice la causa honesta: esa dirección no existe. Sin accusing al cliente de
 *    nada, porque no es verdad que el cliente se haya ido.
 * 2. Devuelve a la puerta en un toque, donde se ven los clientes de verdad.
 * 3. Reclama el typo sin humillar a nadie: la lista de proyectos reales es la
 *    que la persona puede leer y corregir en el segundo.
 *
 * ES HTML PLANO, sin script ni iframe a propósito: el CSP del hub permite
 * `unsafe-inline` para scripts, pero una pantalla de error no necesita ejecutar
 * nada. Un 404 que ejecuta código es un 404 que también puede romperse.
 *
 * Solo texto y un link, como el resto de la familia visual: mismo logo, mismo
 * negro, Space Grotesk para lo que se lee.
 */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-20">
      <p className="mb-8 flex items-center gap-2.5" aria-label="RR Aliados">
        <span aria-hidden="true" className="block h-6 w-6 bg-fucsia" />
        <span className="font-display text-sm font-bold tracking-[0.28em] text-blanco">
          RR ALIADOS
        </span>
      </p>

      <p className="mono-label text-mostaza">// 404 · RUTA NO ENCONTRADA</p>

      <h1 className="mt-4 font-display text-3xl font-bold text-blanco sm:text-4xl">
        Esta dirección no existe
      </h1>

      <p className="mt-4 text-sm leading-7 text-blanco-60">
        Puede que el enlace haya venido con una letra de menos, o que el proyecto
        no esté en esa dirección. El cliente no se ha borrado: sigue en la puerta
        de entrada, con su código.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="inline-flex items-center border-2 border-mostaza px-5 py-3 font-mono text-xs tracking-[0.15em] text-mostaza hover:bg-mostaza hover:text-negro"
        >
          IR A LA PUERTA →
        </Link>
        <Link
          href="/"
          className="inline-flex items-center border-2 border-blanco-20 px-5 py-3 font-mono text-xs tracking-[0.15em] text-blanco-60 hover:border-blanco-40"
        >
          VOLVER A LA PORTADA
        </Link>
      </div>

      <p className="mt-10 font-mono text-[10px] leading-5 text-blanco-40">
        Si el enlace te lo mandó RR Aliados y debería abrir una idea, escríbele a
        Dirección: puede que la idea haya cambiado de código.
      </p>
    </main>
  );
}