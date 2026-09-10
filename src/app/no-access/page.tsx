import Link from 'next/link';
export default function NoAccess() {
  return (
    <div className="min-h-screen bg-negro flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display font-bold text-3xl text-blanco mb-4">
          SIN ACCESO
        </h1>
        <p className="font-mono text-sm text-blanco-60 mb-8">
          Tu cuenta no tiene proyectos asignados.
          <br />
          Contacta al administrador de RR ALIADOS.
        </p>
        <Link href="/login" className="btn-brutal inline-block">
          VOLVER AL INICIO
        </Link>
      </div>
    </div>
  );
}
