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

  it('ELEGIR QUIÉN VOTA ya no es un enlace: es el selector, en la barra', () => {
    // MEDIDO 2026-10-03. Este aserto exigía un `<Link>` abierto con el texto
    // ELEGIR QUIÉN VOTA, y pasó a fallar al arreglar «no deja cambiar el perfil»:
    // el enlace se iba a otra pantalla y el selector entró en su lugar.
    //
    // Un test que obliga a mantener un enlace con esa etiqueta está obligando a
    // mantener el bug. Este ya no exige el enlace: exige que el rótulo con esa
    // promesa tenga debajo un selector, que es lo que hace.
    const shell = leer('src/components/workspace-shell.tsx');
    expect(shell).toContain('<SelectorPerfil slug={slug} pedirEquipo />');
    // El enlace a la pantalla de votación sobrevive, con su propio nombre.
    expect(shell).toMatch(/VOTACIÓN INTERNA/);
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

describe('el hilo de comentarios se usa sin sesion', () => {
  it('el autor sale del perfil elegido, no de la sesion', () => {
    // MEDIDO 2026-10-03. Publicar en el hilo respondia «Entra con el codigo de tu
    // cliente»: el comentario era la parte del hub que mas se usa sin ser
    // cliente, y era la unica que exigia sesion. MEDIDO en produccion: el boton
    // se activaba, se pulsaba y no se publicaba nada.
    const cliente = leer('src/lib/workspace-client.ts');
    expect(cliente).toMatch(/authorProfile/);

    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toContain('body.authorProfile');
  });

  it('el perfil se comprueba en la base, y sin perfil se explica', () => {
    // Acotado al bloque de `comment`. Hay otro `identidad` en la ruta de `vote`
    // (el perfil de quien vota), y un aserto sobre el archivo entero loaba con
    // el del voto: quitar el del comentario dejaba el test verde sin comprobar
    // nada. Dos caminos, mismo nombre de variable, un solo aserto: no sirve.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    const bloque = ruta.slice(ruta.indexOf("action === 'comment'"));
    expect(bloque).toMatch(/const identidad = perfil \|\| email/);
    expect(bloque).toMatch(/ilike\('email', identidad\)/);
    expect(bloque).toMatch(/Elige con qué perfil/);
  });

  it('el rol sale de la idea, no del slug que dice quien llama', () => {
    // MEDIDO: con la puerta por codigo `ctx.proyecto` es el cliente con el que
    // se entro, que no tiene por que ser el dueno de la idea. Consultar la fila
    // de acceso con ese slug daria el rol de otro cliente.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    const bloque = ruta.slice(ruta.indexOf("action === 'comment'"));
    expect(bloque).toContain("from('rr_hub_ideas').select('project_id')");
  });

  it('el refresco del hilo funciona sin sesion', () => {
    // MEDIDO 2026-10-03. Este endpoint devolvia 401 sin sesion, y con el el
    // `refresh()` del hilo se quedaba sin hacer nada: se publicaba un
    // comentario, la respuesta decia "Comentario publicado" y la lista NO
    // cambiaba. Publicar y no verse.
    const pieza = leer('src/app/api/workspace/pieza/route.ts');
    expect(pieza).not.toMatch(/if \(!sesion\)[\s\S]{0,120}status: 401/);
    // Con sesion, el cruce con el cliente de la cookie se mantiene.
    expect(pieza).toMatch(/if \(sesion && proyectoSlug !== sesion\.proyecto\)/);
    // Y la idea tiene que existir: si no hay slug, no hay pieza.
    expect(pieza).toMatch(/if \(!proyectoSlug\)/);
  });

  it('el selector de perfil esta pegado al campo de comentario', () => {
    // Un selector escondido en otro menu es la razon por la que el hilo no se
    // usaba: habia que ir a buscarlo antes de poder comentar.
    const comp = leer('src/components/collaboration-enhanced.tsx');
    expect(comp).toContain('SelectorPerfil');
    expect(comp).toMatch(/!puedeComentar\)/);
  });
});


describe('abrir comment y vote sin sesion no abre el resto', () => {
  it('el owner en modo abierto solo vale para comment y vote', () => {
    // MEDIDO 2026-10-03. `ctx.abierto` daba `owner` a quien llama, y eso era
    // inocuo solo porque `abierto` era SIEMPRE false. Al abrir comment y vote sin
    // sesion, un `owner` de verdad habria dado a cualquiera que abriera la URL
    // `transition`, `borrar`, `script` y `update`: mover, borrar y reescribir
    // cualquier pieza de cualquier cliente.
    //
    // Este test existe para que ese `owner` no vuelva a ampliarse por accidente.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toMatch(/ABIERTAS_EN_EQUIPO = new Set\(\['comment', 'vote'\]\)/);
    expect(ruta).toMatch(/ABIERTAS_EN_EQUIPO\.has\(action\) \? 'owner' : null/);
  });

  it('las dos acciones del equipo son las unicas que no exigen sesion', () => {
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta).toMatch(/ABIERTAS_SIN_SESION = new Set\(\['comment', 'vote'\]\)/);
    // Y una accion de escritura que no este en la lista NO puede colarse.
    for (const accion of ['transition', 'borrar', 'script', 'update', 'asset']) {
      expect(ruta, accion).not.toMatch(new RegExp(`ABIERTAS_SIN_SESION[^\]]*'${accion}'`));
    }
  });

  it('sin perfil del equipo, comentar y votar siguen rechazados', () => {
    // Abrir la puerta no es abrir el turno: el perfil se comprueba en la base.
    const ruta = leer('src/app/api/workspace/[action]/route.ts');
    expect(ruta.match(/is_team_member/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});


describe('cambiar de perfil es cambiar un perfil, no irse a otra pantalla', () => {
  it('la barra tiene el selector, no un enlace que se lleva a otro sitio', () => {
    // MEDIDO 2026-10-03. «No deja cambiar el perfil». En la barra había un
    // `<Link href="/{slug}/ideas/en-votacion">ELEGIR QUIÉN VOTA</Link>`: un enlace
    // con esa etiqueta promete elegir y entrega otra pantalla. MEDIDO en
    // producción: `tagName = "A"`, `href = "/candilejas/ideas/en-votacion"`, y el
    // selector no existía en el tablero. El único camino para cambiar de perfil
    // era salirse del tablero.
    const shell = leer('src/components/workspace-shell.tsx');
    const barra = shell.slice(shell.indexOf('SIN PUERTA'));
    expect(barra).toContain('<SelectorPerfil');
    expect(barra).not.toMatch(/ELEGIR QUIÉN VOTA<\/Link>/);
  });

  it('el enlace a la pantalla de votación sigue ahí, pero con su propio nombre', () => {
    const shell = leer('src/components/workspace-shell.tsx');
    expect(shell).toContain('/ideas/en-votacion');
    expect(shell).toMatch(/VOTACIÓN INTERNA/);
  });

  it('guardar un perfil avisa a esta misma pestaña', () => {
    // MEDIDO 2026-10-03. `suscribirPerfil` escuchaba solo el evento `storage`, y
    // el navegador NO lo dispara en la pestaña que escribe: solo en las demás. El
    // bug era visible en la propia pestaña —elegir un perfil y el botón seguía
    // diciendo ELEGIR QUIÉN VOTA—, y eso es «no deja cambiar el perfil».
    const lib = leer('src/lib/perfil-votante.ts');
    expect(lib).toMatch(/EVENTO_PERFIL/);
    expect(lib).toMatch(/avisarCambioPerfil\(\)/);
    expect(lib).toMatch(/addEventListener\(EVENTO_PERFIL, alCambiar\)/);
    // Y `guardarPerfil` tiene que llamarla: un evento propio que nadie dispara
    // no arregla nada.
    const guardar = lib.slice(lib.indexOf('export function guardarPerfil'));
    const fin = guardar.indexOf('export ');
    expect(guardar.slice(0, fin > 0 ? fin : guardar.length)).toMatch(/avisarCambioPerfil\(\)/);
  });

  it('con perfil elegido el botón dice que se puede cambiar', () => {
    const comp = leer('src/components/selector-perfil.tsx');
    expect(comp).toMatch(/CAMBIAR · /);
  });

  it('el aviso de "elige tu perfil" no sale cuando ya hay perfil', () => {
    // MEDIDO 2026-10-03. El aviso se pintaba con `!puedeVotar`, que se calcula
    // con `esDelEquipo(...)`. Con perfil elegido pero `equipo` aún vacío, el
    // aviso decía «Elige tu perfil» encima de un perfil YA elegido, y cambiar no
    // lo quitaba: parecía que el botón no hacía nada.
    const comp = leer('src/components/selector-perfil.tsx');
    expect(comp).toMatch(/\{!elegido && \(/);
    expect(comp).not.toMatch(/\{!puedeVotar && \(/);
  });

  it('mientras se pide el equipo no dice que no hay equipo', () => {
    const comp = leer('src/components/selector-perfil.tsx');
    // Acotado al JSX de los dos retornos, no al archivo: la primera aparición de
    // cada rótulo está en un comentario que lo explica, y comparar sobre eso
    // daba el orden equivocado y no miraba el código.
    // El orden de las dos guardas es el contrato: si `sinEquipo` se comprueba
    // antes que `cargando`, un tablero vacío muestra «SIN EQUIPO...» durante la
    // carga. No se compara el tamaño de los bloques (frágil: depende de cuánto
    // comentario lleve cada uno) sino DÓNDE cae cada guarda.
    const iCarga = comp.indexOf('if (cargando) {');
    const iVacia = comp.indexOf('if (sinEquipo) {');
    expect(iCarga).toBeGreaterThan(-1);
    expect(iVacia).toBeGreaterThan(-1);
    expect(iCarga).toBeLessThan(iVacia);
    expect(comp.slice(iCarga, iVacia)).toContain('CARGANDO EQUIPO');
    expect(comp.slice(iVacia)).toContain('SIN EQUIPO DE VOTACIÓN CONFIGURADO');
  });
});
