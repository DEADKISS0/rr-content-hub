'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icons';

/**
 * Instalar el hub como app, y el aviso de que hay versión nueva.
 *
 * Santiago, 2026-09-30: "hasta que se pueda descargar como 'app' con el icono de
 * RR desde el navegador, asi como acceso directo desde Android y iPhone".
 *
 * POR QUE HAY QUE PREGUNTAR Y NO INSTALAR SOLO. El evento `beforeinstallprompt`
 * solo se dispara UNA vez por navegador. Si se llama en el `useEffect` al entrar
 * y el usuario cierra el dialogo del navegador, ese evento ya se gasto: no hay
 * segunda oportunidad y no se puede volver a lanzar. Guardarlo y ofrecer un
 * botón propio es lo unico que deja repetir la accion.
 *
 * iOS NO TIENE EL EVENTO. Safari no dispara `beforeinstallprompt` nunca, y por
 * eso un boton que solo escucha ese evento seria un boton que no hace nada en el
 * iPhone de medio equipo. En iOS lo que hay es "Compartir > Añadir a pantalla de
 * inicio", asi que ahi se le explica el camino en vez de prometer una descarga.
 *
 * EL SW, Y POR QUE SE REGISTRA TARDE. Registrarlo en el layout haria que
 * Next montara el shell entero desde la cache en la primera visita, que es
 * justo cuando no hay nada guardado todavia. Aqui se registra al montar, con la
 * pagina ya en pantalla.
 */

/**
 * Clave del aviso de iPhone.
 *
 * MEDIDO 2026-10-04: estaba en `sessionStorage`, que se borra al cerrar la
 * pestaña. El panel de iOS son 114 px fijos en la esquina inferior derecha y
 * MEDIDO con dedo real a 390 px se comia los TRES enlaces del pie y el boton de
 * la guia. Es decir: un aviso que ya se leyo volvio a estorbar en cada recarga.
 *
 * En `localStorage` sale una vez y no vuelve. El boton de «INSTALAR EL HUB»
 * sigue ahi para quien quiera leerlo otra vez.
 */
const CLAVE_IOS = 'rr_instalar_ios_cerrado';

type Instalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Suscripción al cierre del aviso de iOS. Vive FUERA del componente: si se
 * declara dentro, `useSyncExternalStore` recibe una función nueva en cada render
 * y se resuscribe sin parar.
 */
const EVENTO_IOS = 'rr_instalar_ios_cerrado_cambio';

const oyenteIOS = (alCambiar: () => void) => {
  // MEDIDO 2026-10-04: el evento `storage` SOLO se dispara entre pestañas
  // distintas. Escribir en `localStorage` desde la MISMA pestaña no notifica a
  // nadie — ni siquiera a quien escribe—, asi que `useSyncExternalStore` se
  // quedaba con el valor viejo y el boton «ENTENDIDO» no cerraba el panel.
  //
  // Se sigue escuchando `storage` para el caso de verdad que sí cubre (otra
  // pestaña lo cierra) y se añade un evento propio para el caso que no
  // cubria: esta misma pestaña.
  window.addEventListener('storage', alCambiar);
  window.addEventListener(EVENTO_IOS, alCambiar);
  return () => {
    window.removeEventListener('storage', alCambiar);
    window.removeEventListener(EVENTO_IOS, alCambiar);
  };
};

/** Escribe la preferencia y avisa a ESTA pestaña, que `storage` no avisa. */
const cerrarAvisoIOS = () => {
  localStorage.setItem(CLAVE_IOS, 'cerrado');
  window.dispatchEvent(new Event(EVENTO_IOS));
};
const leerIOScerrado = () =>
  typeof window === 'undefined' ? false : localStorage.getItem(CLAVE_IOS) === 'cerrado';

/**
 * "¿Ya estoy en la app?" y "¿esto es un iPhone?" son del ENTORNO, no de la
 * interaccion: se resuelven leyendo, y el servidor responde `false` para que el
 * primer render coincida con el HTML. Meterlos en `useState` + `useEffect` es lo
 * que dispara `react-hooks/set-state-in-effect`, que el linter de React 19
 * rechaza: un `setState` sincrono en un efecto son renders en cascada.
 */
const leerSiInstalada = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};
const leerEsIOS = () => {
  if (typeof window === 'undefined') return false;
  const agente = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(agente) || (agente.includes('Macintosh') && 'ontouchend' in document);
};
const oyenteEntorno = (alCambiar: () => void) => {
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', alCambiar);
  return () => mq.removeEventListener('change', alCambiar);
};
const FALSO = () => false;

export function reabrirAvisoDeInstalar() {
  try { localStorage.removeItem(CLAVE_IOS); } catch { /* da igual */ }
  // MEDIDO 2026-10-05: quitar la clave no basta — el aviso se lee con
  // `useSyncExternalStore`, y `storage` no avisa a la pestana que escribe. Sin
  // este `dispatch`, el botón no hacía nada visible hasta recargar.
  window.dispatchEvent(new Event(EVENTO_IOS));
}

export function InstalarApp() {
  const [invitacion, setInvitacion] = useState<Instalar | null>(null);
  const [instaladaAhora, setInstaladaAhora] = useState(false);
  const [actualizada, setActualizada] = useState(false);
  const yaInstalada = useSyncExternalStore(oyenteEntorno, leerSiInstalada, FALSO)
    || instaladaAhora;
  const esIOS = useSyncExternalStore(oyenteEntorno, leerEsIOS, FALSO);
  // El cierre del aviso de iOS es una preferencia de la SESIÓN, no un dato de la
  // interfaz: se lee durante el render con `useSyncExternalStore` en vez de con
  // `setState` dentro de un efecto, que el linter de React 19 rechaza.
  const cerradoIOS = useSyncExternalStore(oyenteIOS, leerIOScerrado, () => false);

  useEffect(() => {
    const alPedir = (evento: Event) => {
      // Sin esto, Chrome saca su propio mini-infobar y el boton propio no aparece.
      evento.preventDefault();
      setInvitacion(evento as Instalar);
    };
    const alInstalar = () => {
      setInstaladaAhora(true);
      setInvitacion(null);
    };

    window.addEventListener('beforeinstallprompt', alPedir);
    window.addEventListener('appinstalled', alInstalar);

    // El service worker. Solo si el navegador lo soporta: en iOS, registrarlo es
    // un no-op y Safari 16+ ni lo expone en muchos casos.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Sin SW la app sigue funcionando, solo pierde el arranque sin conexion.
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', alPedir);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  // Version nueva disponible: se avisa, no se fuerza. Al recargar entra.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let vivo = true;
    navigator.serviceWorker.getRegistration().then((registro) => {
      registro?.addEventListener('updatefound', () => {
        const entrante = registro.installing;
        entrante?.addEventListener('statechange', () => {
          // Ya hay una que controla la pagina y hay otra esperando: recargara.
          if (vivo && entrante.state === 'installed' && navigator.serviceWorker.controller) {
            setActualizada(true);
          }
        });
      });
    });
    return () => { vivo = false; };
  }, []);

  if (yaInstalada && !actualizada) return null;

  if (actualizada) {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="fixed bottom-16 right-4 z-40 border border-mostaza bg-negro px-4 py-2.5 font-mono text-[11px] tracking-wider text-mostaza sm:bottom-20 sm:right-6"
      >
        HAY VERSIÓN NUEVA · TOCA PARA ACTUALIZAR
      </button>
    );
  }

  // iOS: no hay evento, se le explica el camino. Un boton que no hace nada es peor
  // que un texto que dice que hacer.
  // MEDIDO 2026-10-05: si la persona ya le dio ENTENDIDO, el aviso no vuelve a
  // salir solo —pero tampoco se queda sin salida: hay un boton para pedirlo de
  // nuevo. Respetar la decision no es cerrar la puerta con llave.
  if (esIOS) {
    if (cerradoIOS) return null;
    return (
      // MEDIDO 2026-10-04 con el dedo: este aviso estaba en `bottom-16` con
      // `w-[min(92vw,26rem)]`, y el botón flotante de la guía vive en `bottom-20`
      // a la izquierda. Playwright lo dice sin rodeos: el div «intercepts
      // pointer events». En 390 px el aviso ocupa casi todo el ancho y se come
      // el botón entero — la guía no se podía abrir con el dedo.
      //
      // Se sube a `bottom-28` y se le angosta el ancho para que el botón de la
      // guía quede libre abajo a la izquierda.
      <div className="fixed bottom-28 right-4 z-40 w-[min(80vw,22rem)] border border-blanco-20 bg-negro px-4 py-3 sm:bottom-32 sm:right-6">
        <p className="font-mono text-[10px] tracking-widest text-mostaza">// INSTALAR EN EL IPHONE</p>
        <p className="mt-1.5 text-xs leading-5 text-blanco-70">
          Toca <Icon name="link" size={12} className="inline align-[-2px]" /> <strong className="text-blanco">Compartir</strong> y luego{' '}
          <strong className="text-blanco">Añadir a pantalla de inicio</strong>. Sale con el icono de RR.
        </p>
        <button
          type="button"
          onClick={cerrarAvisoIOS}
          className="mt-2 text-[11px] text-blanco-40 underline"
        >
          ENTENDIDO
        </button>
      </div>
    );
  }

  if (!invitacion) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await invitacion.prompt();
        const eleccion = await invitacion.userChoice;
        // No se guarda: el evento se gasto y no hay segunda vuelta.
        if (eleccion.outcome === 'dismissed') setInvitacion(null);
      }}
      // MEDIDO 2026-10-01, Santiago: «no esta funcionando muy bien el tema de
      // el como se usa». La causa real: este boton era `fixed bottom-4 left-1/2
      // -translate-x-1/2`, osea CENTRADO ABAJO. Medido en el navegador: el
      // boton ENTRAR vivia en y=533 y este en y=515, ambos de 46px de alto, uno
      // encima del otro. El texto «ENTRAR» quedaba tapado y la persona no podia
      // pulsar el centro del boton. Ahora va a una esquina y no tapa nada.
      className="btn-brutal fixed bottom-4 right-4 z-40 sm:right-6"
    >
      <Icon name="upload" size={13} className="inline align-[-2px]" /> INSTALAR EL HUB
    </button>
  );
}
