/**
 * A dónde va la persona después de entrar.
 *
 * MEDIDO 2026-10-01: Santiago abrió el link de una idea, entró al Hub con el
 * código y el nombre, y aterrizó en el tablero del proyecto. El link no estaba
 * roto: el login estaba descartando la ruta que el middleware le había pasado.
 *
 * El middleware deja la ruta en `?next=`, y al terminar el login se iba siempre
 * a `/${cliente.slug}`. Esa línea era el bug entero: el link abría, la persona
 * se autenticaba, y a los dos segundos estaba en otra pantalla. Con una idea
 * abierta en el celular eso se lee como "el link está roto".
 *
 * Este archivo existe para que la decisión sea testeable sin renderizar nada:
 * la regla es una función pura, y el componente solo la llama.
 */

/**
 * El destino después de entrar.
 *
 * Reglas, en orden:
 *
 * 1. Si no hay `next`, se va a la portada del cliente. Es el caso de siempre:
 *    quien entra sin link aterriza en el tablero, no en un error.
 * 2. `next` tiene que ser una ruta INTERNA: empieza por `/` y no por `//`.
 *    Sin esto, `/login?next=https://otro.example` convierte nuestra página en
 *    un redirector de phishing con nuestra propia marca.
 * 3. No puede volver al propio login, ni a la puerta de la PWA: eso sería un
 *    bucle de redirección, y el síntoma es una página en blanco.
 * 4. Un `next` de otro cliente no se respeta: entra a Candilejas y lo manda a
 *    una idea de Wundeer terminaría en un 404. Se cae a la portada.
 */
export function destinoTrasEntrar(next: string | null | undefined, slugCliente: string): string {
  const portada = `/${slugCliente}`;

  if (!next) return portada;

  const limpio = next.trim();
  if (!limpio.startsWith('/')) return portada;
  // `//evil.example` es un URL con protocolo heredado, no una ruta interna.
  if (limpio.startsWith('//')) return portada;

  // Sin query ni hash: solo nos interesa la ruta.
  const ruta = limpio.split('?')[0].split('#')[0];
  if (!ruta || ruta === '/') return portada;

  // Bucles: volver a la puerta o instalar la PWA desde la puerta.
  if (ruta === '/login') return portada;

  // Otro cliente del que entraste: una idea de Candilejas no existe en
  // Wundeer, y el 404 de esa ficha es exactamente lo que Santiago reportó.
  const otroCliente = ruta.split('/')[1];
  if (otroCliente && otroCliente !== slugCliente) return portada;

  return ruta;
}