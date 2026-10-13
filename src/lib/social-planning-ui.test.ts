import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const rutaPage = new URL('../app/[projectSlug]/redes/page.tsx', import.meta.url);
const rutaComponente = new URL('../components/social-planning/social-planning-shell.tsx', import.meta.url);

describe('pantalla local de Plan de publicacion', () => {
  it('expone la ruta /[projectSlug]/redes con el plan mock del cliente', () => {
    expect(existsSync(rutaPage)).toBe(true);
    const page = readFileSync(rutaPage, 'utf8');

    expect(page).toMatch(/planPublicacionDe/);
    expect(page).toMatch(/SocialPlanningShell/);
    expect(page).toMatch(/notFound/);
  });

  it('renderiza un mock tipo Instagram con drag and drop, aprobacion e iframe', () => {
    expect(existsSync(rutaComponente)).toBe(true);
    const componente = readFileSync(rutaComponente, 'utf8');

    expect(componente).toMatch(/Plan de publicación/);
    expect(componente).toMatch(/Grilla 3x3/);
    expect(componente).toMatch(/draggable/);
    expect(componente).toMatch(/onDragStart/);
    expect(componente).toMatch(/onDrop/);
    expect(componente).toMatch(/Aprobar publicación/);
    expect(componente).toMatch(/Pedir cambios/);
    expect(componente).toMatch(/iframe/);
    expect(componente).toMatch(/src=\{initialPlan\.prototipo\.url\}/);
  });

  it('permite editar la publicacion seleccionada y previsualizar media de Drive o URL', () => {
    const componente = readFileSync(rutaComponente, 'utf8');

    expect(componente).toMatch(/onActualizar/);
    expect(componente).not.toMatch(/Titulo editable/);
    expect(componente).toMatch(/Descripcion editable/);
    expect(componente).toMatch(/URL del contenido o carpeta de Drive/);
    expect(componente).toMatch(/URL de portada/);
    expect(componente.indexOf('URL del contenido o carpeta de Drive')).toBeLessThan(componente.indexOf('Descripcion editable'));
    expect(componente).toMatch(/embedDeMedia/);
    expect(componente).toMatch(/Vista final de publicacion/);
    expect(componente).toMatch(/textarea/);
  });

  it('pide feedback antes de marcar cambios y muestra una maqueta separada para pauta', () => {
    const componente = readFileSync(rutaComponente, 'utf8');

    expect(componente).toMatch(/Comentario del cambio/);
    expect(componente).toMatch(/Confirmar solicitud/);
    expect(componente).toMatch(/PAUTA PUBLICITARIA/);
    expect(componente).toMatch(/Patrocinado/);
    expect(componente).toMatch(/Comprar ahora/);
    expect(componente).toMatch(/Instagram/);
  });

  it('muestra un roadmap grande y deja el boton del prototipo en el contenedor del iframe', () => {
    const componente = readFileSync(rutaComponente, 'utf8');

    expect(componente).toMatch(/roadmapSteps/);
    expect(componente).toMatch(/Flujo de aprobación/);
    expect(componente).toMatch(/Abrir prototipo completo/);
    expect(componente).not.toMatch(/\[PROTOTIPO\]/);
  });
});
