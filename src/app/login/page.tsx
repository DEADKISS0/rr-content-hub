'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError('Configura Supabase para activar el acceso con Google. El modo demo está disponible en desarrollo.');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-negro flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display font-bold text-4xl md:text-5xl text-blanco tracking-tight mb-4">
            RR CONTENT HUB
          </h1>
          <p className="font-mono text-sm text-blanco-60">
            // Sistema de gestión de contenido
          </p>
        </div>

        {/* Login Card */}
        <div className="card-brutal">
          <div className="space-y-6">
            <div>
              <h2 className="font-display font-bold text-xl text-blanco mb-2">
                INICIAR SESIÓN
              </h2>
              <p className="font-mono text-xs text-blanco-60">
                Usa tu cuenta de Google autorizada por RR ALIADOS
              </p>
            </div>

            {error && (
              <div className="p-4 border-2 border-fucsia bg-fucsia/10">
                <p className="font-mono text-sm text-fucsia">{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full btn-brutal flex items-center justify-center gap-3"
            >
              {loading ? (
                <span className="font-mono text-sm">CONECTANDO...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>CONTINUAR CON GOOGLE</span>
                </>
              )}
            </button>

            <div className="pt-4 border-t border-blanco-10">
              <p className="font-mono text-xs text-blanco-40 text-center">
                Solo emails autorizados por RR ALIADOS
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="font-mono text-xs text-blanco-40">
            RR ALIADOS S.A.S. — Con las manos en el fuego
          </p>
        </div>
      </div>
    </div>
  );
}
