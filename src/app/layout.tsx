import type { Metadata } from 'next';
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
      <body>{children}</body>
    </html>
  );
}
