'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
      <h2 className="text-xl font-bold text-blanco">Algo salió mal</h2>
      <p className="text-blanco-50 text-sm text-center max-w-md">
        {error.message || 'No se pudo cargar esta sección. Intenta de nuevo.'}
      </p>
      <button
        onClick={() => reset()}
        className="btn-brutal mt-2"
      >
        Reintentar
      </button>
    </div>
  );
}