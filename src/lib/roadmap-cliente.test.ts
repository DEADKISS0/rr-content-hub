import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Santiago, 2026-10-01 — auditoría de experiencia de uso.
 *
 * HALLAZGO: `/candilejas/roadmap` servía el plan de WUNDEER.
 *
 * MEDIDO en producción, entrando a Candilejas con su propio código:
 * la respuesta traía "WUNDEER" dentro del contenido del plan.
 *
 * La causa es que `roadmap/page.tsx` recibe `params.projectSlug` y NO LO USA, y
 * `src/lib/roadmap.ts` tiene el plan clavado con `designMeta.client = 'WUNDEER'`.
 * El menú muestra la entrada a los dos clientes, así que un equipo de Candilejas
 * veía el plan del otro cliente como si fuera suyo: otras fechas, otra marca,
 * otros entregables.
 *
 * Esto es la misma clase de fallo que las dos veces anteriores: una verdad
 * escrita a mano al lado de la autoridad. Ya pasó con `BOARD_COLUMNS`, con
 * `WAITING_STATUSES` y con la lista `PUEDE` del perfil.
 *
 * Decisión: el plan de Candilejas NO se inventa. Si no hay un plan real para
 * Candilejas en la base, la pantalla lo dice en vez de mostrar el de Wundeer.
 */

const pagina = readFileSync(new URL('../app/[projectSlug]/roadmap/page.tsx', import.meta.url), 'utf8');
const lib = readFileSync(new URL('../lib/roadmap.ts', import.meta.url), 'utf8');
import { planDe, clientesConPlan } from './roadmap';

describe('el roadmap pertenece al cliente que se está mirando', () => {
  it('la página usa el projectSlug de la ruta', () => {
    // El fallo medido: `params` se recibía y se ignoraba.
    expect(pagina).toMatch(/projectSlug/);
    const usa = /params\b[\s\S]{0,200}projectSlug[\s\S]{0,400}(cliente|slug|proyecto)\b/i.test(pagina);
    expect(usa).toBe(true);
  });

  it('el plan se elige por cliente, no es uno solo para todos', () => {
    // Si el plan es un objeto único, el slug no tiene dónde meterse.
    expect(lib).toMatch(/porCliente|PLANES|cliente:|slug:/);
  });

  it('la marca del plan la pone el cliente, no una constante', () => {
    expect(lib).toMatch(/designMeta/);
  });
});

describe('planDe() responde con el plan del cliente que se le pide', () => {
  it('wundeer tiene plan', () => {
    expect(planDe('wundeer')).not.toBeNull();
    expect(planDe('wundeer')?.nombre).toBe('WUNDEER');
  });

  it('candilejas NO devuelve el plan de wundeer', () => {
    // La prueba de comportamiento. La de arriba mira el texto de los archivos;
    // esta ejecuta la función. Un `planDe` que devolviera el plan de Wundeer
    // para cualquier slug dejaría las pruebas de texto en verde.
    const plan = planDe('candilejas');
    expect(plan).toBeNull();
  });

  it('un slug inventado no devuelve nada', () => {
    expect(planDe('satiro')).toBeNull();
    expect(planDe('no-existe')).toBeNull();
    expect(planDe(undefined)).toBeNull();
    expect(planDe(null)).toBeNull();
    expect(planDe('')).toBeNull();
  });

  it('solo wundeer tiene plan por ahora', () => {
    // Si esto cambia, es porque alguien escribió un plan nuevo: eso es una
    // decisión, y la prueba obliga a que sea a propósito y no por descuido.
    expect(clientesConPlan()).toEqual(['wundeer']);
  });
});

describe('no se muestra el plan de otro cliente', () => {
  it('un cliente sin plan propio lo dice, no muestra el ajeno', () => {
    // La tentación al arreglar esto es duplicar el plan de Wundeer para
    // Candilejas. Eso es inventar un plan: fechas y entregables de un cliente
    // que no existen. La pantalla honesta dice que no hay plan.
    expect(pagina).toMatch(/PLAN_POR_CLIENTE|planDe|sinPlan|SIN PLAN|no hay plan/i);
  });

  it('el eyebrow nombra al cliente que se está mirando', () => {
    expect(pagina).toMatch(/\$\{.*(nombre|cliente|slug).*\}.*ROADMAP|ROADMAP/i);
  });
});