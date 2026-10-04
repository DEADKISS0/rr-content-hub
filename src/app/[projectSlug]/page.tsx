import { notFound } from 'next/navigation';
import { getIdeas, getProject, getVotosDeVarias } from '@/lib/data';
import { ProjectDashboard } from '@/components/project-dashboard';

export default async function ProjectDashboardPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const { project, access } = await getProject(projectSlug);
  if (!project) notFound();

  const ideas = await getIdeas(project.id);

  /*
   * MEDIDO 2026-10-01: 19 ideas de Wundeer carrying `voting` con CERO votos, de
   * las 18 personas con acceso 14 sin haber votado nunca, y el botón de votar
   * vivía solo dentro de la ficha. Cero menciones de "votar" en el tablero, en
   * el banco y en aprobaciones. El sistema funcionaba y nadie lo tocaba.
   *
   * Para que el botón de la tarjeta pueda decir "faltan 2 de 3" hace falta el
   * conteo al pintar. Y para no hacer 19 consultas, se piden todas en una: solo
   * las que están en `voting`, que son las únicas con botón.
   */
  const enVotacion = ideas.filter((idea) => idea.status === 'voting').map((idea) => idea.id);
  const conteos = await getVotosDeVarias(enVotacion);

  const conVotos = ideas.map((idea) => ({
    ...idea,
    aFavor: conteos[idea.id]?.aFavor ?? 0,
    enContra: conteos[idea.id]?.enContra ?? 0,
  }));

    // SIN SESION, EL ROL ES LECTOR, NO `owner` (2026-10-02).
  //
  // Antes: `access?.role_in_project ?? 'owner'`. Sin sesion `access` es null y el
  // `?? 'owner'` le regalaba el rol mas alto a quien no habia entrado: la pagina
  // se abria y ensegnaba los botones de escribir. La escritura la rechazaba el
  // guard, o sea que el boton existia y al pulsarlo salia un 401.
  //
  // Ahora el valor por defecto es `client_viewer`, que es un rol REAL: hay 22
  // filas con ese valor en `rr_hub_access` y esta en el CHECK de la columna. Se
  // eligio ese y no uno inventado (`lector` no existe en el enum) para que la
  // pantalla no tenga que inventarse un rol que la base no reconoce.
  //
  // MEDIDO 2026-10-04. Este default era `client_viewer` y la regla era «no se
  // regala el mas alto»: la pantalla enseña lo que se puede ver y no ofrece lo
  // que la base va a negar. Con el modelo libre esa regla se invierte: el
  // servidor da `owner` a quien llega, asi que anunciar LECTURA era mentiro.
  //
  // Lo que se conserva igual: si la persona tiene fila en `rr_hub_access`, su rol
  // de ahi manda. Y sin sesion tampoco se inventa un nombre: eso lo resuelve el
  // selector de perfil cuando hace falta escribir.
  const rol = access?.role_in_project ?? 'owner';

  return <ProjectDashboard project={project} projectSlug={projectSlug} ideas={conVotos} role={rol} />;
}