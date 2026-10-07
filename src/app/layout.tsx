import type { Metadata, Viewport } from 'next';
import { Latido } from '@/components/presencia-equipo';
import { InstalarApp } from '@/components/instalar-app';
import './globals.css';

/**
 * Layout raíz del hub.
 *
 * LO QUE HACE EL METADATA PARA LA APP (Santiago, 2026-09-30: "hasta que se pueda
 * descargar como 'app' con el icono de RR desde el navegador, asi como acceso
 * directo desde Android y iPhone"). Las cuatro claves que hacen falta, y por
 * qué cada una:
 *
 * - `manifest` apunta a `src/app/manifest.ts`. Sin esto el navegador no ofrece
 *   instalar nada, por muy bonitos que sean los iconos.
 * - `appleWebApp` produce `mobile-web-app-capable`, pero a Safari NO le vale:
 *   lo que reconoce es `apple-mobile-web-app-capable`, con el prefijo. Medido en
 *   `node_modules/next/dist/lib/metadata/metadata.js:606`, que es donde sale la
 *   clave sin prefijo, y medido en produccion: sin la de Apple el iPhone abre el
 *   sitio con barra de Safari y no aparece "Añadir a pantalla de inicio" como app.
 *   Por eso la clave de Apple se pone a mano en `other`.
 * - `apple-touch-icon` es el icono de la pantalla de inicio en iOS. Sin él iOS
 *   saca una captura de la página, que con este hub es un rectángulo negro.
 * - `icons` cubre el favicon de escritorio.
 *
 * `themeColor` va en `viewport`, no aquí: Next lo ignora dentro de `metadata` en
 * esta versión, y sin él la barra del navegador sale de otro color en Android.
 */
export const metadata: Metadata = {
  title: 'RR Content Hub',
  description: 'Sistema de gestión de contenido para RR ALIADOS y clientes',
  openGraph: {
    type: 'website',
    siteName: 'RR Content Hub',
  },
  manifest: '/manifest.webmanifest',
  applicationName: 'RR Content Hub',
  appleWebApp: {
    capable: true,
    title: 'RR Hub',
    // Sin esto iOS lo muestra con barra de navegador y no como app.
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  // La clave que Safari SÍ lee. Next emite la moderna en `appleWebApp`, pero la
  // de Apple es la que decide si el iPhone ofrece instalarla como app.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/app/icono-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/app/icono-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/app/icono-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/app/icono-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/app/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#070001',
  // `viewport-fit=cover` + el `env(safe-area-inset-*)` que ya usan los
  // componentes: sin esto, en un iPhone con notch la barra lateral y la guía
  // quedan debajo de la barra de estado y del gesto de inicio.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {/*
          El latido va en el layout raíz, y no en cada página, para que el
          equipo esté marcado en línea venga de donde venga. Sin sesión no hace
          nada: el endpoint contesta 401 y eso es lo correcto.
        */}
        <Latido />
        {children}
        {/*
          El botón de instalar y el aviso de versión nueva viven aquí, en un solo
          sitio y en todas las páginas: el evento `beforeinstallprompt` se
          dispara una sola vez y hay que guardarlo para poder ofrecer el botón.
        */}
        <InstalarApp />
      </body>
    </html>
  );
}
