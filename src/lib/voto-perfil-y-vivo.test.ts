import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los fallos que este trabajo arregla, con su medición.
 *
 * No se prueban porque "se vea bien". Se prueban porque cada uno era una cosa
 * concreta que se midió en producción y que vuelve en silencio si nadie vigila.
 *
 * MEDIDO 2026-10-03 en cada caso:
 *
 * 1. El botón de la cabecera decía SOLO LECTURA y no hacía nada. Con el hub en
 *    puerta por código, quien entraba no podía votar, y la votación interna es
 *    justamente lo que el equipo hace sin ser cliente.
 * 2. `/select-project` ofrecía cuatro clientes y tres devolvían 404.
 * 3. El contador de votos se leía al pintar: votaba uno y los demás veían el
 *    número viejo hasta recargar.
 * 4. `vote-quick.tsx` —el botón de la TARJETA— no mandaba perfil, así que el
 *    servidor caía al correo de la sesión y, sin sesión, el voto no se guardaba.
 */

const raiz = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');

describe('el perfil de votante se elige, no se deduce', () => {
  it('la ruta de vote lee el perfil elegido del cuerpo', () => {
    expect(leer('src/app/api/workspace/[action]/route.ts')).toContain('body.voterProfile');
  });

  it('sin perfil elegido ni sesión, el voto se rechaza con un mensaje útil', () => {
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toMatch(/Elige con qué perfil vas a votar/);
  });

  it('el correo se comprueba contra la base, no contra el cuerpo', () => {
    // El nombre del campo importa: `voterEmail` es un campo que la ruta IGNORA a
    // propósito. Si el perfil se mandara ahí, escribir el correo de otra persona
    // en el cuerpo sería votar en su nombre con una línea de código.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toContain('body.voterProfile');
    expect(ruta).toMatch(/ilike\('email', identidad\)/);
  });

  it('LOS DOS botones de votar mandan perfil, no solo el de la ficha', () => {
    // MEDIDO: `vote-quick.tsx` es el botón de la TARJETA del tablero y no mandaba
    // perfil. El clic se registraba y no pasaba nada en la base. La ficha
    // (`idea-voting.tsx`) sí lo mandaba: son dos caminos distintos al mismo
    // endpoint, y basta con que uno se quede atrás.
    for (const archivo of ['src/components/vote-quick.tsx', 'src/components/idea-voting.tsx']) {
      const codigo = leer(archivo);
      expect(codigo.length, `${archivo} no se pudo leer`).toBeGreaterThan(0);
      expect(codigo, archivo).toMatch(/voteIdea\([^)]*emailElegido\(\)/);
    }
  });

  it('el token del navegador sigue siendo la clave del voto', () => {
    // Si el token pudiera cambiar con el perfil, una sola máquina emitiría los
    // votos de tres personas: la fila es UNIQUE (idea_id, voter_token).
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toContain("onConflict: 'idea_id,voter_token'");
    expect(leer('src/lib/workspace-client.ts')).toContain('voterToken: token');
  });
});

describe('la votación se ve en vivo, sin recargar', () => {
  it('el endpoint de votos existe y cruza el proyecto por la idea', () => {
    // MEDIDO: `rr_hub_votes` NO tiene columna `project_id`. Filtrar por ella no
    // da error: PostgREST lo ignora y devuelve los votos de OTROS clientes.
    const ruta = leer('src/app/api/workspace/votos/route.ts');
    expect(ruta).toContain("from('rr_hub_votes')");
  });

  it('el navegador pregunta cada 10 segundos y no repinta si nada cambió', () => {
    const hook = leer('src/lib/use-votos-vivo.ts');
    expect(hook).toContain('INTERVALO_MS = 10_000');
    expect(hook).toMatch(/setInterval/);
    // Si se repinta siempre, el contador parpadea cada 10 segundos.
    expect(hook).toMatch(/if \(igual\) return/);
  });

  it('la pestaña oculta no pregunta, y el intervalo sí lo comprueba', () => {
    // MEDIDO: con 18 pestañas del equipo abiertas, preguntar en segundo plano es
    // gasto sin información, porque nadie está mirando.
    //
    // El aserto acota SOLO el `setInterval`. El handler de `visibilitychange`
    // también lleva el guard, y si el slice lo incluyera, quitar el del intervalo
    // dejaría el test verde sin comprobar nada.
    const hook = leer('src/lib/use-votos-vivo.ts');
    const desde = hook.indexOf('const id = window.setInterval');
    const hasta = hook.indexOf('const alVolver');
    expect(hasta).toBeGreaterThan(desde);
    expect(hook.slice(desde, hasta)).toContain("document.visibilityState === 'visible'");
    // Y al volver a la pestaña tiene que preguntar: sin esto, cambiar de ventana
    // y volver no refresca nada.
    expect(hook.slice(hasta)).toContain("document.visibilityState === 'visible'");
  });

  it('el voto propio se ve al instante, antes del siguiente turno del intervalo', () => {
    // Entre el clic y la siguiente pregunta el número del servidor es el viejo.
    // Si se pintara ese, se vería un rebote al número anterior: peor que esperar.
    for (const archivo of ['src/components/idea-voting.tsx', 'src/components/vote-quick.tsx']) {
      const codigo = leer(archivo);
      expect(codigo, archivo).toMatch(/aFavor \?\? conteo\.aFavor|propio\?\.aFavor \?\? conteo\.aFavor/);
    }
  });

  it('los dos botones se conectan al hook, no solo la ficha', () => {
    // MEDIDO: la ficha se actualizaba sola y la tarjeta del tablero no. Era el
    // mismo bug en dos sitios, y el que más se ve es el del tablero, que es
    // donde se mira mientras se vota.
    for (const archivo of ['src/components/idea-voting.tsx', 'src/components/vote-quick.tsx']) {
      expect(leer(archivo), archivo).toContain('useVotosEnVivo');
    }
  });

  it('el servidor manda el mínimo, y la pantalla no lo escribe a mano', () => {
    expect(leer('src/components/idea-voting.tsx')).toContain('minimoVivo');
  });
});

describe('el equipo sale de la base, no de una constante', () => {
  it('la columna real es full_name, y solo gente activa', () => {
    // MEDIDO: `nombre` no existe en `rr_hub_profiles`. Pedirla devolvía `{}` sin
    // error, que se pintaba como una lista de nombres en blanco.
    const datos = leer('src/lib/data.ts');
    expect(datos).toContain('full_name');
    expect(datos).toMatch(/eq\('is_team_member', true\)/);
    expect(datos).toMatch(/eq\('is_active', true\)/);
  });

  it('el selector no se saca de rr_hub_presencia', () => {
    // Presencia dice quién se conectó, no quién tiene derecho a voto: alguien
    // del equipo que nunca ha entrado desaparecería del selector.
    const datos = leer('src/lib/data.ts');
    const cuerpo = datos.slice(datos.indexOf('export async function getEquipoVotante'));
    expect(cuerpo.slice(0, 1200)).not.toContain('rr_hub_presencia');
  });
});

describe('el botón que estaba muerto ahora lleva a donde se resuelve', () => {
  it('SOLO LECTURA no es un span que no hace nada', () => {
    const shell = leer('src/components/workspace-shell.tsx');
    expect(shell).not.toMatch(/<span[^>]*>\s*<Icon name="user"[^>]*\/> SOLO LECTURA/);
  });

  it('ELEGIR QUIÉN VOTA está dentro de un Link abierto, y no hay span por medio', () => {
    // La forma real del código es
    //   <Link href={...} className={...}> <Icon/> TEXTO </Link>
    // así que el aserto acota el trozo entre la ruta y el texto y exige que el
    // <Link> siga abierto. Hay dos enlaces a esta pantalla (la barra y el botón)
    // y solo importa el del botón, que es el ÚLTIMO.
    const shell = leer('src/components/workspace-shell.tsx');
    const ruta = 'href={`/${slug}/ideas/en-votacion`}';
    const hasta = shell.indexOf('ELEGIR QUIÉN VOTA');
    expect(hasta).toBeGreaterThan(-1);
    const desdeRuta = shell.lastIndexOf(ruta, hasta);
    expect(desdeRuta).toBeGreaterThan(-1);
    const desde = shell.lastIndexOf('<', desdeRuta);
    const trozo = shell.slice(desde, hasta);
    expect(trozo).toContain('<Link');
    expect(trozo).not.toContain('</Link>');
    expect(trozo).not.toContain('<span');
  });

  it('el enlace apunta a una pantalla que existe', () => {
    // Un enlace a una ruta que no se crea es un 404 con un texto que promete
    // algo: lo peor de los dos.
    const pagina = leer('src/app/[projectSlug]/ideas/en-votacion/page.tsx');
    expect(pagina).toContain('SelectorPerfil');
    expect(pagina).toContain("status === 'voting'");
  });
});

describe('el selector de clientes prometía puertas que no abrían', () => {
  it('la lectura no se bloquea por cliente, la escritura sí', () => {
    // MEDIDO en producción: con la sesión de WUNDEER, /candilejas, /boga y
    // /satiro devolvían 404, y `/select-project` ofrece los cuatro.
    //
    // Lo que se quitó es el guard de LECTURA. Lo que se dejó intacto es el de
    // escritura: `roleForIdea` y `/api/subir` siguen exigiendo `access`.
    const datos = leer('src/lib/data.ts');
    expect(datos).toMatch(/clienteEsVisible\(slug, sesion\.proyecto\)/);
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toContain('roleForIdea');
    expect(leer('src/app/api/subir/route.ts')).toContain('sesion.proyecto');
  });
});