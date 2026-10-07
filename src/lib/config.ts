import { z } from 'zod';

/**
 * Configuración centralizada del RR Content Hub.
 *
 * Antes cada archivo parseaba `process.env` a su manera: la misma variable
 * se dividía por comas en tres sitios, se recortaba en otros, y en uno se
 * olvidaba el `filter(Boolean)`. Eso es tres definiciones que se
 * desincronizan, y ya pasó: `SUPER_ADMIN_EMAILS` tenía un `filter(Boolean)`
 * en `admin-guard.ts` pero no en `project-guard.ts`, y un espacio al final
 * del env dejaba pasar a alguien que no existía.
 *
 * Zod obliga a que el tipo sea EXACTAMENTE el que dice: si la variable no
 * está, si no es string, o si el split da algo raro, el parseo dice dónde
 * y por qué. No es defensa contra un atacante — es defensa contra un
 * despliegue con la variable mal escrita.
 */

function envStr(name: string): string {
  const value = process.env[name];
  if (value === undefined) return '';
  return value;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const configSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  HUB_CATALOGO_VISIBLE: z.array(z.string()).default([]),
  SUPER_ADMIN_EMAILS: z.array(z.string()).default([]),
  RR_HUB_AUTOMATION_TOKEN: z.string().min(1).optional(),
  HUB_E2E_STATE: z.string().optional(),
});

const raw = {
  SUPABASE_SERVICE_ROLE_KEY: envStr('SUPABASE_SERVICE_ROLE_KEY'),
  NEXT_PUBLIC_SUPABASE_URL: envStr('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: envStr('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  HUB_CATALOGO_VISIBLE: splitCsv(envStr('HUB_CATALOGO_VISIBLE')),
  SUPER_ADMIN_EMAILS: splitCsv(envStr('SUPER_ADMIN_EMAILS')),
  RR_HUB_AUTOMATION_TOKEN: envStr('RR_HUB_AUTOMATION_TOKEN') || undefined,
  HUB_E2E_STATE: envStr('HUB_E2E_STATE') || undefined,
};

const parsed = configSchema.safeParse(raw);

export const hubConfig = parsed.success
  ? parsed.data
  : (parsed.error.issues.forEach((issue) => {
      console.error(`[hub-config] ${issue.path.join('.')}: ${issue.message}`);
    }),
    // En desarrollo/demo se devuelve lo que venga para no bloquear el arranque.
    // En producción el log es visible y el proceso sigue; la ruta que necesite
    // una variable faltante responde 503.
    raw as z.infer<typeof configSchema>);

/**
 * ¿Está este slug en el catálogo visible?
 *
 * Si `HUB_CATALOGO_VISIBLE` está vacío, se deja pasar TODO: el default
 * seguro es "no configurado = no filtrar", porque filtrar todo por
 * defecto deja el hub vacío y eso es peor que mostrar de más.
 */
export function catalogoIncluye(slug: string): boolean {
  const lista = hubConfig.HUB_CATALOGO_VISIBLE;
  if (lista.length === 0) return true;
  return lista.includes(slug.trim().toLowerCase());
}

/**
 * ¿Este correo es super-admin por configuración?
 */
export function esSuperAdmin(email: string): boolean {
  return hubConfig.SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
