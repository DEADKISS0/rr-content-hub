import { redirect } from 'next/navigation';

/**
 * La puerta por código ya no es el camino de entrada. El hub se recorre
 * sin pedir nada; el nombre se pide solo al subir una idea.
 * `/login` redirige para que un enlace viejo no abra esa pantalla.
 */
export default function LoginPage() {
  redirect('/');
}
