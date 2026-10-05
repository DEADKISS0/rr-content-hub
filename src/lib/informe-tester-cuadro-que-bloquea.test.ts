import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Los dos fallos que reportó el tester el 2026-10-05, en PC y en móvil.
 *
 * 1. «Al ingresar como usuario se despliega un cuadro que permanece en pantalla y
 *    bloquea la interactividad de la página entera. Permite navegar pero no
 *    interactuar.»  MEDIDO: lo que bloqueaba era la guía (`div.fixed inset-0
 *    z-50` recibía el toque en el centro en los dos tamaños). Tenía salida —
 *    `SALTAR`, Escape, `YA ENTENDÍ`— pero los tres botones estaban abajo y en
 *    iPhone quedaban bajo el pliegue: quien entra no ve que hay salida y la web
 *    parece rota.
 *
 * 2. «Al darle al botón ENTENDIDO no cierra la ventana. Permanece ahí todo el
 *    tiempo de navegación.»  MEDIDO: el botón sí escribía, pero en
 *    `sessionStorage` —que se olvida al cerrar la pestaña— y se avisaba el
 *    cambio por `storage`, que no notifica a la pestaña que escribe. O sea:
 *    cierre invisible y aviso que volvía en cada recarga.
 */

const RUTA_GUIA = 'src/components/guided-tour.tsx';
const RUTA_AVISO = 'src/components/instalar-app.tsx';

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

describe('el cuadro que bloqueaba la pagina', () => {
  it('la guia tiene una X de cerrar visible arriba a la derecha', () => {
    const guia = leer(RUTA_GUIA);
    // La salida que cualquiera reconoce sin instrucción. Va ANTES del texto, no
    // después: si se quita, no hay forma visible de salir desde el primer paso.
    expect(guia).toMatch(/aria-label="Cerrar la guía"/);
    const x = guia.indexOf('aria-label="Cerrar la guía"');
    const titulo = guia.indexOf('PASO {paso! + 1}');
    expect(x).toBeGreaterThan(-1);
    expect(x).toBeLessThan(titulo);
    // Y es de verdad pulsable con el dedo: 44px, el mínimo táctil.
    // MEDIDO: la primera versión exigía `h-11 w-11` ANTES de `onClick`, y el
    // test fallaba con el código correcto: en el componente el `onClick` va
    // primero y las clases después. Un test que obliga a un orden que el
    // formateador puede cambiar no vigila el comportamiento: mide estilo.
    expect(guia).toMatch(/aria-label="Cerrar la guía"[\s\S]{0,400}h-11 w-11/);
  });

  it('la tarjeta reserva el alto de la X para que no pise el titulo', () => {
    const guia = leer(RUTA_GUIA);
    // Sin `pt-14` la X queda encima del «PASO 1 DE 6».
    //
    // MEDIDO 2026-10-05: `main` construye la tarjeta con un ternario de clases
    // (una rama pegada al objetivo y otra centrada), y solo la segunda lleva
    // `p-5`. El test se ancla a esa rama en vez de inventar una clase que el
    // formateador puede mover.
    expect(guia).toMatch(/overflow-y-auto p-5 pt-14/);
  });

  it('cerrar la guia sigue funcionando por el resto de vias', () => {
    const guia = leer(RUTA_GUIA);
    // Escape, el boton de saltar y el de ya entendi siguen ahi: la X es una via
    // mas, no un reemplazo.
    expect(guia).toMatch(/event\.key === 'Escape'\) cerrar\(\)/);
    expect(guia).toMatch(/\{ultimo \? 'CERRAR' : 'SALTAR'\}/);
    expect(guia).toMatch(/\{ultimo \? 'YA ENTENDÍ' : 'SIGUIENTE'\}/);
  });
});

describe('el aviso de instalar que no cerraba y volvia siempre', () => {
  it('la decision se guarda en localStorage, no en sessionStorage', () => {
    const aviso = leer(RUTA_AVISO);
    // MEDIDO: en `sessionStorage` el aviso se olvidaba al cerrar la pestana y
    // volvia en cada recarga. Si esto vuelve a `sessionStorage`, el aviso
    // regresa y el tester lo vuelve a reportar.
    expect(aviso).toMatch(/localStorage\.getItem\(CLAVE_IOS\) === 'cerrado'/);
    expect(aviso).toMatch(/localStorage\.setItem\(CLAVE_IOS, 'cerrado'\)/);
    // Ningun uso en codigo: solo puede quedar en comentarios, contando el porque.
    const codigo = aviso
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('*') && !linea.trim().startsWith('//'))
      .join('\n');
    expect(codigo).not.toContain('sessionStorage');
  });

  it('cerrar dispara un aviso propio: storage no notifica a la pestana que escribe', () => {
    const aviso = leer(RUTA_AVISO);
    // MEDIDO: el boton escribia y ya, y el `onClick` del boton de aviso sigue
    // llamando a `avisarCambioAviso()`. Si desaparece esa llamada, ENTENDIDO
    // vuelve a no cerrar nada hasta que se recargue.
    // MEDIDO 2026-10-05: al resolver el conflicto con `main` apareció que ya
    // existía `cerrarAvisoIOS()`, que escribe y dispara el evento. Mi versión
    // duplicaba esa lógica con otro nombre; ahora se usa la que ya había y el
    // test sigue vigilando lo mismo: que cerrar avise a ESTA pestaña.
    expect(aviso).toMatch(/const cerrarAvisoIOS = \(\) => \{/);
    expect(aviso).toMatch(/localStorage\.setItem\(CLAVE_IOS, 'cerrado'\);[\s\S]{0,120}dispatchEvent\(new Event\(EVENTO_IOS\)\)/);
    // Y se escucha en el mismo `window`, no solo en `storage`.
    expect(aviso).toMatch(/addEventListener\(EVENTO_IOS, alCambiar\)/);
    expect(aviso).toMatch(/removeEventListener\(EVENTO_IOS, alCambiar\)/);
  });

  it('respetar el cierre no deja la puerta cerrada con llave', () => {
    const aviso = leer(RUTA_AVISO);
    expect(aviso).toMatch(/export function reabrirAvisoDeInstalar\(\)/);
    expect(aviso).toMatch(/localStorage\.removeItem\(CLAVE_IOS\)/);
    // Y hay un camino visible para usarla.
    const guia = leer(RUTA_GUIA);
    expect(guia).toContain('reabrirAvisoDeInstalar');
    expect(guia).toContain('AVISO INSTALAR');
  });
});
