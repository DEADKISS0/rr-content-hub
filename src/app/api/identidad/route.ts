import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { crearSesion, NOMBRE_COOKIE } from '@/lib/hub-session';
import { mismoNombre, nombreValido } from '@/lib/identidad';
import { createServiceClient } from '@/lib/supabase/service';
import { RESPUESTA_LIMITE } from '@/lib/rate-limit';
import { checkDbLimit, recordDbFailure, recordDbSuccess, retryAfterDb } from '../_lib/rate-limit-db';

/**
 * Identidad por nombre, al subir una idea.
 *
 * GET  → nombres ya registrados (id y nombre, sin correos).
 * POST → elige un perfil de la lista o escribe un nombre nuevo. Firma la
 *        cookie `hub_sesion`. No pide código de cliente ni confirma por correo.
 *
 * Si el nombre escrito coincide con uno registrado, no se asume: responde 409
 * con ese perfil para que se elija en la lista.
 *
 * Un invitado nuevo se crea con correo sintético `invitado+…@invitados.hub`
 * y `email_confirm: true`, así no sale ningún correo. No se inserta fila en
 * `rr_hub_access` ni se toca una policy.
 */

function origenDe(peticion: Request): string {
  const cadena = peticion.headers.get('x-forwarded-for') ?? '';
  const primera = cadena.split(',')[0]?.trim();
  return primera || 'desconocido';
}

type PerfilNombre = { id: string; full_name: string | null; email: string; is_active: boolean | null };

async function listarPerfiles() {
  const supabase = await createServiceClient();
  if (!supabase) return { supabase: null, perfiles: [] as PerfilNombre[] };
  const { data } = await supabase
    .from('rr_hub_profiles')
    .select('id, full_name, email, is_active')
    .order('full_name', { ascending: true });
  const perfiles = ((data ?? []) as PerfilNombre[]).filter((p) => p.is_active !== false && (p.full_name || '').trim());
  return { supabase, perfiles };
}

export async function GET() {
  const { perfiles } = await listarPerfiles();
  return NextResponse.json({
    nombres: perfiles.map((p) => ({ id: p.id, nombre: (p.full_name || '').trim() })),
  });
}

export async function POST(request: Request) {
  const origen = origenDe(request);
  const path = '/api/identidad';

  const ok = await checkDbLimit(origen, path);
  if (!ok) {
    const espera = await retryAfterDb(origen, path);
    const respuesta = NextResponse.json(RESPUESTA_LIMITE.cuerpo, { status: RESPUESTA_LIMITE.status });
    respuesta.headers.set('Retry-After', String(espera));
    return respuesta;
  }

  let cuerpo: { projectSlug?: string; perfilId?: string; nombre?: string };
  try {
    cuerpo = await request.json();
  } catch {
    await recordDbFailure(origen, path);
    return NextResponse.json({ error: 'No se entendió la petición.' }, { status: 400 });
  }

  const projectSlug = String(cuerpo.projectSlug ?? '').trim().toLowerCase();
  if (!projectSlug) {
    await recordDbFailure(origen, path);
    return NextResponse.json({ error: 'Falta el cliente de esta idea.' }, { status: 400 });
  }

  const { supabase, perfiles } = await listarPerfiles();
  if (!supabase) {
    return NextResponse.json({ error: 'No se pudo comprobar la identidad.' }, { status: 503 });
  }

  const { data: proyecto } = await supabase
    .from('rr_hub_projects')
    .select('id')
    .eq('slug', projectSlug)
    .maybeSingle();
  if (!proyecto) {
    await recordDbFailure(origen, path);
    return NextResponse.json({ error: 'No se encontró ese cliente.' }, { status: 404 });
  }

  let email: string;
  let nombre: string;

  const perfilId = String(cuerpo.perfilId ?? '').trim();
  if (perfilId) {
    const perfil = perfiles.find((p) => p.id === perfilId);
    if (!perfil) {
      await recordDbFailure(origen, path);
      return NextResponse.json({ error: 'Ese nombre no está en la lista.' }, { status: 404 });
    }
    email = perfil.email;
    nombre = (perfil.full_name || '').trim();
  } else {
    const escrito = nombreValido(cuerpo.nombre);
    if (!escrito) {
      await recordDbFailure(origen, path);
      return NextResponse.json({ error: 'Escribe un nombre de al menos dos letras.' }, { status: 400 });
    }
    const coincidencias = perfiles.filter((p) => mismoNombre(p.full_name || '', escrito));
    if (coincidencias.length > 0) {
      return NextResponse.json({
        error: 'Ese nombre ya está registrado. Elígelo en la lista para no tomarlo por error.',
        coincidencias: coincidencias.map((p) => ({ id: p.id, nombre: (p.full_name || '').trim() })),
      }, { status: 409 });
    }

    const sintetico = `invitado+${randomBytes(8).toString('hex')}@invitados.hub`;
    const creado = await supabase.auth.admin.createUser({
      email: sintetico,
      email_confirm: true,
      user_metadata: { full_name: escrito },
    });
    if (creado.error || !creado.data.user) {
      console.error('[identidad] no se pudo crear el invitado', creado.error?.message);
      return NextResponse.json({ error: 'No se pudo entrar con ese nombre.' }, { status: 500 });
    }

    email = sintetico;
    nombre = escrito;

    const { data: ya } = await supabase
      .from('rr_hub_profiles')
      .select('id')
      .eq('id', creado.data.user.id)
      .maybeSingle();
    if (!ya) {
      const { error: alta } = await supabase.from('rr_hub_profiles').insert({
        id: creado.data.user.id,
        email: sintetico,
        full_name: escrito,
        is_team_member: false,
        is_active: true,
      });
      if (alta) {
        console.error('[identidad] no se pudo escribir el perfil', alta.message);
        return NextResponse.json({ error: 'No se pudo entrar con ese nombre.' }, { status: 500 });
      }
    } else {
      await supabase
        .from('rr_hub_profiles')
        .update({ full_name: escrito, is_active: true })
        .eq('id', creado.data.user.id);
    }
  }

  let valor: string;
  let maxAge: number;
  try {
    ({ valor, maxAge } = crearSesion({ nombre, email, proyecto: projectSlug }));
  } catch (error) {
    console.error('[identidad] no se pudo firmar la sesión', error);
    return NextResponse.json({ error: 'No se pudo entrar con ese nombre.' }, { status: 500 });
  }

  await recordDbSuccess(origen, path);
  const respuesta = NextResponse.json({ nombre, email });
  respuesta.cookies.set(NOMBRE_COOKIE, valor, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return respuesta;
}
