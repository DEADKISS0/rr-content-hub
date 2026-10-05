import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * El cliente de Wundeer tiene que poder APROBAR desde su perfil, sin sesión de
 * Google. MEDIDO 2026-10-04 con el dedo a 390 px: abría la ficha de O6
 * («ESPERANDO AL CLIENTE») y la columna de acción decía «SIN ACCIÓN DISPONIBLE».
 * No había botón. Santiago: «asegúrate de que el perfil de los dos de Wundeer
 * puedan entrar desde esos perfiles y poder aprobar».
 *
 * Eran DOS fallos encadenados, y con el primero arreglado el segundo seguía
 * dando 403 — por eso este test mira los dos:
 *
 * 1. El botón no salía. La ficha recibe `rolEnProyecto()` del servidor, que
 *    corre antes de que exista el perfil elegido: ese perfil vive en
 *    `localStorage`. Sin sesión, el guard cae a `client_viewer` (ver
 *    `AUTH_ENABLED = true` en `lib/mode.ts`), y `IdeaActions` oculta todo lo que
 *    ese rol no puede hacer.
 * 2. El botón habría sido rechazado aunque saliera. `rr_hub_access` tenía a los
 *    dos clientes como `client_viewer` (solo lectura), y la transición de
 *    `pending_approval` exige `client_approver`.
 *
 * La regla que queda fija: el rol sale SIEMPRE de la fila de la base. Ni el
 * cuerpo de la petición ni una variable del navegador conceden un permiso.
 */

const RUTA_API = 'src/app/api/workspace/[action]/route.ts';
const RUTA_FICHA = 'src/components/idea-actions.tsx';
const RUTA_CLIENTE = 'src/lib/workspace-client.ts';
const RUTA_FLUJO = 'src/lib/flow.ts';

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

describe('el cliente aprueba desde su propio perfil', () => {
  it('el servidor resuelve el rol del perfil elegido contra la base de datos', () => {
    const api = leer(RUTA_API);
    expect(api).toContain('async function roleForPerfilElegido');
    // La identidad llega, pero el permiso se LEE de `rr_hub_access`.
    expect(api).toContain('actorProfile');
    expect(api).toMatch(/from\('rr_hub_access'\)[\s\S]{0,200}role_in_project/);
    // Y se entrega con la acción de transición, que es la que lo necesita.
    expect(api).toContain('roleForPerfilElegido(service, projectId, identidad)');
  });

  it('un perfil inexistente o desactivado no recibe ningún rol', () => {
    const api = leer(RUTA_API);
    const bloque = api.slice(api.indexOf('async function roleForPerfilElegido'));
    const cuerpo = bloque.slice(0, bloque.indexOf('\n}'));
    expect(cuerpo).toMatch(/if \(!perfil \|\| perfil\.is_active === false\) return null/);
    // Sin fila de acceso, `null`: nunca un rol por omisión.
    expect(cuerpo).toMatch(/return \(acceso\?\.role_in_project as RoleKey\) \?\? null/);
  });

  it('la ficha pregunta su rol en vez de quedarse con el de la prop', () => {
    const ficha = leer(RUTA_FICHA);
    expect(ficha).toContain("postWorkspaceAction('mi-rol'");
    expect(ficha).toContain('rolServidor');
    // El rol del servidor TIENE que ganarle al de la prop; si se invirtiera,
    // volvería el «SIN ACCIÓN DISPONIBLE» de siempre.
    expect(ficha).toContain('const rolEfectivo = rolServidor ?? role');
    expect(ficha).toMatch(/const activeRole = \(ROLE_KEYS\.includes\(rolEfectivo/);
  });

  it('el cambio de perfil vuelve a preguntar el rol', () => {
    const ficha = leer(RUTA_FICHA);
    // Sin esto, elegir «Cliente Wundeer 1» con la ficha abierta no quita el
    // «SIN ACCIÓN DISPONIBLE» hasta que se recarga a mano.
    //
    // MEDIDO: la versión anterior de esta aserción era `toContain('suscribirPerfil')`
    // y NO moría — al revertir la llamada, el `import` seguía en el archivo y el
    // test pasaba igual. Un test que sobrevive a la reversión no vigila nada, así
    // que ahora mira la LLAMADA, con su desuscripción al lado: quitar cualquiera
    // de las dos lo tumba.
    expect(ficha).toMatch(/const quitar = suscribirPerfil\(\(\) => \{ void preguntar\(\); \}\)/);
    expect(ficha).toMatch(/return \(\) => \{ vivo = false; quitar\(\); \}/);
  });

  it('la transición va con el perfil con el que se actúa', () => {
    const cliente = leer(RUTA_CLIENTE);
    expect(cliente).toMatch(/actorProfile: perfil\.email/);
    expect(cliente).toContain('perfilElegido');
  });

  it('la regla del flujo NO se ablanda: aprobar sigue siendo del cliente', () => {
    const flujo = leer(RUTA_FLUJO);
    // La puerta lógica queopened todo el cliente la arregla:
    // `client_approver` puede, `client_viewer` no. Si alguien cambiara esto a
    // `roles: 'all'`, cualquiera aprobaría y este test se cae.
    expect(flujo).toMatch(/pending_approval:[\s\S]{0,400}label: 'APROBAR IDEA'[\s\S]{0,120}roles: 'client'/);
    expect(flujo).toMatch(/if \(option\.roles === 'client'\) return role === 'client_approver'/);
  });
});
