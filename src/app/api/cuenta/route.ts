import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/service';
import { crearSesion, NOMBRE_COOKIE } from '@/lib/hub-session';
import {
  puedeIntentar,
  registrarFallo,
  segundosParaReintentar,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Alta en el hub sin salir de la página y sin mandar correo.
 *
 * `auth.admin.createUser` con `email_confirm: true` no dispara el correo de
 * confirmación ni una invitación. No se llama a `inviteUserByEmail`,
 * `signInWithOtp` ni `resetPasswordForEmail`. La contraseña aleatoria no se
 * devuelve ni se guarda en el repo: la persona entra con la cookie del hub,
 * no con una sesión de Supabase en el navegador.
 *
 * El trigger `rr_hub_handle_new_user` (el que ya está en prod) crea
 * `rr_hub_profiles` con `is_team_member = false`. Esta ruta no lo cambia.
 * En el registro rápido añade una fila `editor` SOLO en el cliente que la
 * persona tiene abierto. Un invitado queda con perfil y sin fila de acceso:
 * puede leer, no escribe.
 *
 * No crea políticas ni grants. Escribe con la service role, que ya usa el
 * resto de mutaciones del hub.
 */

type Registro = { fallos: number; desde: number; hasta: number };
const intentos = new Map<string, Registro>();

function origenDe(peticion: Request): string {
  const cadena = peticion.headers.get('x-forwarded-for') ?? '';
  return cadena.split(',')[0]?.trim() || 'desconocido';
}

function correoValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) && valor.length <= 200;
}

export async function POST(request: Request) {
  const clave = `${origenDe(request)}:/api/cuenta`;
  const ahora = Date.now();
  if (!puedeIntentar(intentos.get(clave), ahora)) {
    const espera = segundosParaReintentar(intentos.get(clave), ahora);
    const respuesta = NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento y vuelve a probar.' },
      { status: 429 },
    );
    respuesta.headers.set('Retry-After', String(espera));
    return respuesta;
  }

  let cuerpo: { modo?: string; nombre?: string; correo?: string; proyecto?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'El formulario no se pudo leer.' }, { status: 400 });
  }

  const modo = cuerpo.modo === 'invitado' ? 'invitado' : cuerpo.modo === 'registro' ? 'registro' : '';
  if (!modo) {
    return NextResponse.json({ error: 'Elige registro rápido o modo invitado.' }, { status: 400 });
  }

  const nombrePedido = String(cuerpo.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const nombre = modo === 'invitado' ? (nombrePedido || 'Invitado') : nombrePedido;
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Escribe tu nombre, con al menos dos letras.' }, { status: 400 });
  }

  const proyectoSlug = String(cuerpo.proyecto ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(proyectoSlug)) {
    return NextResponse.json({ error: 'Elige el cliente en el que entras.' }, { status: 400 });
  }

  const correo = modo === 'invitado'
    ? `invitado+${randomBytes(8).toString('hex')}@invitados.hub`
    : String(cuerpo.correo ?? '').trim().toLowerCase();
  if (modo === 'registro' && !correoValido(correo)) {
    intentos.set(clave, registrarFallo(intentos.get(clave), ahora));
    return NextResponse.json({ error: 'Ese correo no es válido.' }, { status: 400 });
  }

  const service = await createServiceClient();
  if (!service) {
    return NextResponse.json({ error: 'El servidor no tiene la configuración de Supabase.' }, { status: 500 });
  }

  const { data: proyecto, error: errorProyecto } = await service
    .from('rr_hub_projects')
    .select('id, slug, name')
    .eq('slug', proyectoSlug)
    .maybeSingle();
  if (errorProyecto || !proyecto) {
    return NextResponse.json({ error: 'Ese cliente no está en el hub.' }, { status: 404 });
  }

  if (modo === 'registro') {
    const { data: ya } = await service
      .from('rr_hub_profiles')
      .select('id')
      .ilike('email', correo)
      .maybeSingle();
    if (ya) {
      intentos.set(clave, registrarFallo(intentos.get(clave), ahora));
      return NextResponse.json(
        { error: 'Ese correo ya tiene perfil. No se reemplaza una cuenta que ya existe.' },
        { status: 409 },
      );
    }
  }

  // Contraseña que nadie ve y que no se usa para entrar. email_confirm evita
  // el correo. No es una invitación.
  const { data: alta, error: errorAlta } = await service.auth.admin.createUser({
    email: correo,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { full_name: nombre },
  });
  if (errorAlta || !alta.user) {
    const yaExiste = /already|registered|exists/i.test(errorAlta?.message ?? '');
    if (yaExiste) {
      intentos.set(clave, registrarFallo(intentos.get(clave), ahora));
      return NextResponse.json(
        { error: 'Ese correo ya tiene perfil. No se reemplaza una cuenta que ya existe.' },
        { status: 409 },
      );
    }
    console.error('[cuenta] no se pudo crear la cuenta:', errorAlta?.message);
    return NextResponse.json({ error: 'No se pudo crear el perfil.' }, { status: 500 });
  }

  const { data: perfil, error: errorPerfil } = await service
    .from('rr_hub_profiles')
    .select('id, email, full_name')
    .eq('id', alta.user.id)
    .maybeSingle();
  if (errorPerfil || !perfil) {
    console.error('[cuenta] el trigger no dejó el perfil:', errorPerfil?.message);
    return NextResponse.json({ error: 'La cuenta se creó pero el perfil no quedó escrito.' }, { status: 500 });
  }

  if (perfil.full_name !== nombre) {
    await service.from('rr_hub_profiles').update({ full_name: nombre }).eq('id', perfil.id);
  }

  if (modo === 'registro') {
    // ignoreDuplicates: si una invitación ya dejó un rol, no se pisa.
    const { error: errorAcceso } = await service.from('rr_hub_access').upsert(
      { user_id: perfil.id, project_id: proyecto.id, role_in_project: 'editor' },
      { onConflict: 'user_id,project_id', ignoreDuplicates: true },
    );
    if (errorAcceso) {
      console.error('[cuenta] no se pudo abrir el cliente:', errorAcceso.message);
      return NextResponse.json({ error: 'El perfil quedó creado pero no se pudo abrir el cliente.' }, { status: 500 });
    }
  }

  await service.from('rr_hub_presencia').upsert(
    {
      email: (perfil.email as string) ?? correo,
      profile_id: perfil.id,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );

  const { valor, maxAge } = crearSesion({
    nombre,
    email: ((perfil.email as string) ?? correo).toLowerCase(),
    proyecto: proyecto.slug,
  });
  const respuesta = NextResponse.json({
    ok: true,
    modo,
    nombre,
    email: ((perfil.email as string) ?? correo).toLowerCase(),
    proyecto: { slug: proyecto.slug, nombre: proyecto.name },
  });
  respuesta.cookies.set(NOMBRE_COOKIE, valor, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return respuesta;
}
