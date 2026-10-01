import { Suspense } from 'react';
import { getClientesParaLaPuerta } from '@/lib/puerta';
import Formulario, { PuertaEsqueleto } from './formulario';

/**
 * La puerta del hub, página de SERVIDOR.
 *
 * MEDIDO 2026-10-01 (Santiago): "en la vista del link raíz solo ofrece entrar al
 * perfil de candilejas, y pues está mal". La lista de clientes estaba escrita a
 * mano en este mismo archivo:
 *
 *   const PUERTAS = [
 *     { slug: 'wundeer',    nombre: 'WUNDEER',    codigo: '1111' },
 *     { slug: 'candilejas', nombre: 'CANDILEJAS', codigo: '2222' },
 *   ];
 *
 * Y en `rr_hub_projects` hay CUATRO clientes. Satiro y Boga existen, tienen sus
 * ideas, y no aparecían: la puerta los escondía porque nadie se acordaba de
 * añadir la línea. Por eso la lista se lee de la base en el SERVIDOR y se pasa
 * al formulario como prop. Ver `lib/puerta.ts`.
 *
 * La separación de archivos no es estilo. Antes esto era todo un `'use client'`
 * con la función `export default` marcada `async`, que Next rechaza con
 * `no-async-client-component`: una página que lee la base tiene que ser de
 * servidor, y lo que usa `useState`/`useSearchParams` tiene que estar en otro
 * archivo. Está en `./formulario`.
 *
 * El `Suspense` está por `useSearchParams`: sin esa frontera, el build falla al
 * prerenderizar `/login` con "useSearchParams should be wrapped in a suspense
 * boundary". Cae alrededor del FORMULARIO, no de la página entera, para que el
 * shell (logo, título, textos) se prerenderice igual.
 */
export default async function LoginPage() {
  const clientes = await getClientesParaLaPuerta();

  return (
    <Suspense fallback={<PuertaEsqueleto />}>
      <Formulario clientes={clientes} />
    </Suspense>
  );
}