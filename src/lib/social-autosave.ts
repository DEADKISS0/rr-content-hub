'use client';

// NX-1028 — autoguardado con estado visible y control de concurrencia.
//
// Tres piezas que en NX-1025 no existían y por eso se perdía trabajo:
//   1. ESTADO visible: el usuario ve «Guardando… / Guardado / Conflicto» en
//      vez de un silencio que no sabe si es éxito o pérdida.
//   2. VERSIÓN: se manda la que se leyó. Si otra persona guardó primero el
//      servidor devuelve 409 y aquí se pinta 'conflicto' sin pisar nada.
//   3. RECUARGA: al entrar se lee el plan del servidor y solo se pinta si los
//      ids coinciden con el plan base (mismo criterio H2 que localStorage).
//
// localStorage sigue escribiéndose en el shell: es el salvavidas cuando no hay
// sesión o la API cae. Esta capa no lo reemplaza, se apoya encima.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SocialPost } from '@/lib/social-planning';
import type { EstadoGuardado, PlanSocial } from '@/lib/social-store';

export type CargaInicial = { posts: SocialPost[]; pautas: SocialPost[] } | null;

type Args = {
  projectSlug: string;
  posts: SocialPost[];
  pautas: SocialPost[];
  listo: boolean;                       // la restauración local ya decidió
  /**
   * NX-1028 paso 3: si la matriz no le permite ni editar ni aprobar, el PUT no
   * se dispara — el servidor respondería 403 y la interfaz pintaría un error
   * que no es del usuario sino de su rol. `undefined` se trata como `true`
   * para no romper a los que todavía no pasan permisos.
   */
  puedeEscribir?: boolean;
  onCargar: (carga: CargaInicial) => void;
  onConflicto: (versionActual: number) => void;
};

const ESPERA_MS = 1200;

export function useSocialAutosave({ projectSlug, posts, pautas, listo, puedeEscribir = true, onCargar, onConflicto }: Args) {
  const [estado, setEstado] = useState<EstadoGuardado>('pendiente');
  const versionRef = useRef<number | null>(null);
  const primerGuardadoRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial: recuperación después de recargar, mandada por el servidor.
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/social-plan?proyecto=${encodeURIComponent(projectSlug)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cuerpo: { plan: PlanSocial | null } | null) => {
        if (!vivo || !cuerpo?.plan) return;
        versionRef.current = cuerpo.plan.version;
        onCargar({ posts: cuerpo.plan.posts, pautas: cuerpo.plan.pautas });
        setEstado('guardado');
      })
      .catch(() => { /* sin API: manda lo local */ });
    return () => { vivo = false; };
  }, [projectSlug, onCargar]);

  const guardar = useCallback(async () => {
    // Sin permiso de la matriz no se manda nada: ni PUT ni estado de error.
    if (!puedeEscribir) return;
    if (versionRef.current === null) {
      // Todavía no se leyó el servidor: se empieza en 0 y el servidor decide.
      versionRef.current = 0;
    }
    setEstado('guardando');
    try {
      const respuesta = await fetch(`/api/social-plan?v=${versionRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, posts, pautas }),
      });
      if (respuesta.status === 409) {
        const cuerpo = (await respuesta.json()) as { versionActual?: number };
        setEstado('conflicto');
        onConflicto(cuerpo.versionActual ?? -1);
        return;
      }
      if (!respuesta.ok) { setEstado('error'); return; }
      const cuerpo = (await respuesta.json()) as { plan: PlanSocial };
      versionRef.current = cuerpo.plan.version;
      setEstado('guardado');
    } catch {
      setEstado('error');
    }
  }, [projectSlug, posts, pautas, puedeEscribir, onConflicto]);

  // Debounce: cada tecla no es un guardado. Se espera a que el tecleo pare.
  useEffect(() => {
    if (!listo) return;
    if (primerGuardadoRef.current) { primerGuardadoRef.current = false; return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    setEstado('pendiente');
    timerRef.current = setTimeout(() => { void guardar(); }, ESPERA_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [posts, pautas, listo, guardar]);

  // `version` no se devuelve: leer un ref durante el render está prohibido y el
  // componente no lo necesita — la versión vive dentro del hook y se manda sola.
  return { estado, guardarAhora: guardar };
}

export const ESTADO_GUARDADO_TEXTO: Record<EstadoGuardado, string> = {
  pendiente: 'Cambios sin guardar',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  conflicto: 'Conflicto: otra persona guardó primero',
  error: 'Sin conexión: cambios solo en este navegador',
};
