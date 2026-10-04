import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MEDIDO 2026-10-02, auditoría del backend y del frontend de RR Content Hub.
 * Cuatro defectos reales, verificados leyendo el código y la base viva.
 *
 * Estos tests son de LECTURA de código a propósito: el repo yaconfirmó que
 * `npm test`, `tsc` y `next build` pasan en verde con todos estos bugs puestos.
 * Un select de columna inexistente, un campo que se pierde al mapear y una
 * clase de Tailwind que no existe NO los ve ningún type-checker.
 */
const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');

/** Todos los .ts/.tsx bajo src/components y src/app, leidos como texto. */
function listaFuente(): string[] {
  const salida: string[] = [];
  const pendientes = ['src/components', 'src/app'];
  while (pendientes.length) {
    const dir = pendientes.pop()!;
    for (const entrada of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const ruta = `${dir}/${entrada.name}`;
      if (entrada.isDirectory()) pendientes.push(ruta);
      else if (/\.(tsx|ts)$/.test(entrada.name)) salida.push(leer(ruta));
    }
  }
  return salida;
}

describe('los comentarios no pueden caer por una columna que no existe', () => {
  const data = leer('src/lib/data.ts');

  it('pide resolved_at, que es el nombre real de la columna', () => {
    // rr_hub_comments tiene `resolved_at`. Pedir `resolved` devuelve 400 42703
    // ANTES del chequeo de permisos, así que tampoco lo tapa la RLS, y el
    // hilo de comentarios de cada ficha salía vacío siempre.
    expect(data).toMatch(/\.select\('id, body, author_label, resolved_at, created_at'\)/);
    expect(data).not.toMatch(/\.select\('id, body, author_label, resolved,/);
  });

  it('el mapeo lee el mismo nombre que pide', () => {
    expect(data).toMatch(/resolved: Boolean\(c\.resolved_at\)/);
    expect(data).not.toMatch(/resolved: Boolean\(c\.resolved\)/);
  });

  it('las dos funciones que leen comentarios usan el mismo nombre', () => {
    // getComentarios y getAuditComments discrepaban: una con `resolved` y la
    // otra con `resolved_at`. No se "arregla" una y se deja la otra.
    const selects = data.match(/author_label, resolved_at, created_at/g) ?? [];
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});

describe('mapIdea no puede perder los campos que ya llegan', () => {
  const data = leer('src/lib/data.ts');

  it('getIdeas pide updated_at, created_by y ad_id', () => {
    const select = data.match(/\.select\('id, code, title[\s\S]*?'\)/)?.[0] ?? '';
    expect(select).toMatch(/updated_at/);
    expect(select).toMatch(/created_by/);
    expect(select).toMatch(/ad_id/);
  });

  it('mapIdea los devuelve', () => {
    // Sin `updated_at`, `daysSince(idea.updated_at ?? idea.created_at)` caía
    // siempre a created_at y una pieza tocada hoy podía leer "14 DÍAS SIN
    // MOVERSE". Sin `created_by`, el responsable salía vacío. Sin `ad_id`, la
    // miniatura del anuncio nunca cargaba.
    const bloque = data.slice(data.indexOf('function mapIdea'), data.indexOf('function mapIdea') + 2600);
    expect(bloque).toMatch(/updated_at:/);
    expect(bloque).toMatch(/created_by:/);
    expect(bloque).toMatch(/ad_id:/);
  });
});

describe('las clases de color que se usan tienen que existir en el theme', () => {
  const css = leer('src/app/globals.css');
  const source = listaFuente().join('\n');

  it('no hay ninguna clase de color usada que falte en el theme', () => {
    // MEDIDO: 20 clases se usaban y no existían. Tailwind no generaba regla y
    // el estilo se perdía en silencio, sin error de build. Las peores:
    // `border-blanco-25` en A FAVOR / EN CONTRA (sin borde, se leían como texto)
    // y `text-blanco-25` / `text-blanco-40` en el contador "FALTAN 2 DE 3".
    const usadas = new Set(
      [...source.matchAll(/\b(?:bg|text|border|from|to|via)-(?:blanco|mostaza|oruquidea|fucsia)-\d+\b/g)]
        .map((m) => m[0].replace(/^(?:bg|text|border|from|to|via)-/, ''))
    );
    const definidas = new Set(
      [...css.matchAll(/--color-([\w-]+):/g)].map((m) => m[1])
    );
    const faltan = [...usadas].filter((c) => !definidas.has(c)).sort();
    expect(faltan).toEqual([]);
  });

  it('el blanco tiene su escala completa, sin huecos', () => {
    // La escala documentada es .05 .10 .15 .20 .25 .30 .40 .50 .60 .70 .80 .90
    for (const paso of ['05', '10', '15', '20', '25', '30', '40', '50', '60', '70', '80', '90']) {
      expect(css).toMatch(new RegExp(`--color-blanco-${paso}:`));
    }
  });
});

describe('los dos botones flotantes de la esquina no se pisan', () => {
  it('la guia sube para dejarle el sitio al instalador', () => {
    // Ambos eran `sm:bottom-4 sm:right-4` con `z-40`. Sin z distinto gana el
    // último en el DOM, y `InstalarApp` se monta después de los hijos: el
    // instalador tapaba "¿CÓMO SE USA?".
    // MEDIDO 2026-10-03: el botón se llamaba buscando `fixed bottom-0`, que era
    // la clase que tenía cuando en móvil cruzaba la pantalla entera. Al cambiarlo
    // a una esquina el aserto dejó de encontrar el botón y devolvía cadena vacía:
    // un test que pasa por no mirar nada.
    //
    // Ahora se busca el ELEMENTO (desde su `<button` hasta `¿CÓMO SE USA?`) y se
    // leen sus clases.
    //
    // MEDIDO 2026-10-04: el aserto exigía `sm:bottom-20`, que es la clase de
    // ESCRITORIO. Se aplicó un cambio de MÓVIL y el test saltó, aunque lo que
    // este test protege —que los dos flotantes no se pisan— seguía cumpliéndose
    // en las dos columnas.
    //
    // Fijar `sm:` era anyways atar el aserto a una media pantalla. Lo que
    // importa es que sus bases de escritorio sean DISTINTAS, para que no se
    // pisen en ningun ancho.
    const guia = leer('src/components/guided-tour.tsx');
    const antes = guia.slice(0, guia.indexOf('¿CÓMO SE USA?'));
    const elemento = antes.slice(antes.lastIndexOf('<button'));
    const linea = elemento.match(/className="([^"]*)"/)?.[1] ?? '';
    expect(linea, 'no se encontró la clase del botón de la guía').not.toBe('');

    const instalar = leer('src/components/instalar-app.tsx');
    const instalador = instalar.match(/btn-brutal[^"]*fixed[^"]*/)?.[0] ?? '';
    expect(instalador, 'no se encontró el botón del instalador').not.toBe('');

    // Las dos columnas, medidas por sus numeros.
    // MEDIDO 2026-10-04, la disposicion real despues de cinco PRs:
    //
    //     guia        fixed bottom-20 left-3   ->  en escritorio sm:right-4
    //     instalador  btn-brutal fixed bottom-4 right-4
    //
    // Se apilan: el instalador al fondo (16 px), la guia encima (80 px). La
    // diferencia son 64 px exactos —`bottom-20` es 5rem, no 6rem, y por eso el
    // numero redondo de la separacion da 64 y no 96— frente a los 44 px del
    // boton mas alto: no se pisan en ninguna pantalla, y el pie baja `pb-20`
    // para dejarles sitio.
    //
    // Lo que este test protege ya no es "la guia tiene sm:bottom-20", que era
    // atar el aserto a una media pantalla y hacia saltar con cada ajuste movil.
    // Es que los DOS base esten separados, que es la razon de que el conflicto
    // exista.
    // MEDIDO 2026-10-04, la disposicion real despues de cinco PRs:
    //
    //     guia        fixed bottom-20 left-3   ->  en escritorio sm:right-4
    //     instalador  btn-brutal fixed bottom-4 right-4
    //
    // Se apilan: el instalador al fondo, la guia encima, con 64 px de separacion
    // para un boton de 44. No se pisan en ninguna pantalla, y el pie baja
    // `pb-20` para dejarles sitio.
    //
    // MEDIDO tambien el nombre de la clase: `bottom-20` es 5rem —80 px—, no
    // 20 px. Comparar los numeros de la escala sin convertir daria 20 y 4, y
    // "20 - 4 = 16 px de separacion" diria justo lo contrario de lo que pasa.
    // La conversion va aqui, una vez, para que el resto del test razone en
    // pixeles de verdad.
    const ESCALA_PX: Record<string, number> = {
      '0': 0, '1': 4, '2': 8, '3': 12, '4': 16, '5': 20, '6': 24, '8': 32,
      '10': 40, '12': 48, '14': 56, '16': 64, '20': 80, '24': 96,
      '28': 112, '32': 128, '36': 144,
    };
    const px = (clase: string, sm = false): number | null => {
      const m = clase.match(new RegExp(`${sm ? 'sm:' : ''}bottom-(\\d+)`));
      if (!m) return null;
      return ESCALA_PX[m[1]] ?? null;
    };

    const guiaPx = px(linea);
    const instaladorPx = px(instalador);
    expect(guiaPx, 'la guia no tiene bottom fijo').not.toBeNull();
    expect(instaladorPx, 'el instalador no tiene bottom fijo').not.toBeNull();
    // La guia por encima del instalador, con hueco para un boton de 44 px.
    expect(guiaPx!).toBeGreaterThan(instaladorPx!);
    expect(guiaPx! - instaladorPx!).toBeGreaterThanOrEqual(44);

    // MEDIDO 2026-10-04: `pb-20` (80 px) NO bastaba. El boton de la guia esta en
    // `bottom-20` —80 px del borde— y mide 44 px de alto, asi que ocupa de 80 a
    // 124. Igualar el `bottom` del boton no sirve: el pie tiene que ultrapassarlo
    // por su altura.
    const pie = leer('src/components/hub-footer.tsx');
    const pieClase = pie.match(/<footer className="([^"]*)"/)?.[1] ?? '';
    const huecoPie = ESCALA_PX[pieClase.match(/\bpb-(\d+)\b/)?.[1] ?? ''] ?? 0;
    // 144 px, no 124. MEDIDO: 128 px (pb-32) DEJABA los dos ultimos enlaces
    // debajo del boton, porque el pie tiene su propio borde de 1 px y el boton
    // se dibuja encima del area de texto, no del padding. El criterio que funciona
    // medido es 144, y un umbral que acepta 128 no protege lo que protege.
    expect(huecoPie, 'el pie no reserva el hueco de los dos flotantes')
      .toBeGreaterThanOrEqual(144);

    expect(linea).toMatch(/sm:right-4/);
    expect(instalador).toMatch(/sm:right-6/);

  });

  it('el instalador sigue en la esquina, no en el centro', () => {
    const instalar = leer('src/components/instalar-app.tsx');
    const clases = instalar
      .split('\n')
      .filter((l) => l.includes('className='))
      .join('\n');
    expect(clases).not.toMatch(/left-1\/2/);
    expect(clases).not.toMatch(/-translate-x-1\/2/);
  });
});
describe('asset no puede cruzar de cliente', () => {
  const ruta = leer('src/app/api/workspace/[action]/route.ts');

  it('el contexto sabe con que cliente entro la persona', () => {
    // Sin esto `asset` no tiene forma de comparar. El tipo lo declara y el
    // unico punto donde se arma lo rellena con `sesion.proyecto`.
    expect(ruta).toMatch(/proyecto: string \| null;/);
    expect(ruta).toMatch(/proyecto: sesion\.proyecto/);
  });

  it('la accion asset rechaza una idea de otro cliente', () => {
    // MEDIDO 2026-10-03: reproducido en produccion. Con la sesion de Wundeer
    // se registro un asset dentro de una idea de Candilejas y la API devolvio
    // `{"success":true}`. El rol no alcanza: ser creator en Wundeer no da
    // escritura en Candilejas.
    const bloque = ruta.slice(ruta.indexOf("action === 'asset'"));
    const hasta = bloque.indexOf('\n  }', 40);
    const accion = bloque.slice(0, Math.max(hasta, 2600));
    expect(accion).toMatch(/rr_hub_projects!inner\(slug\)/);
    expect(accion).toMatch(/slugIdea !== ctx\.proyecto/);
    expect(accion).toMatch(/403/);
  });
});
