import type { Metadata } from 'next';
import { Latido } from '@/components/presencia-equipo';
import './globals.css';

export const metadata: Metadata = {
  title: 'RR Content Hub',
  description: 'Sistema de gestión de contenido para RR ALIADOS y clientes',
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
      </body>
    </html>
  );
}
