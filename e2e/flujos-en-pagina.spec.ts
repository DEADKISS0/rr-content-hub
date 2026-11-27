import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const LOG = '/opt/cursor/artifacts/e2e-flujos.log';
const ARTE = '/opt/cursor/artifacts';

function sql(consulta: string): string {
  return execFileSync(
    'sudo',
    ['-u', 'postgres', 'psql', '-d', 'hub_e2e', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', consulta],
    { encoding: 'utf8' },
  ).trim();
}

function anotar(linea: string) {
  appendFileSync(LOG, `${new Date().toISOString()} ${linea}\n`);
}

test.use({ video: 'on' });
test.setTimeout(120_000);

test('registro, invitado, idea, voto, guion y comentario quedan en la base', async ({ page, browser }) => {
  mkdirSync(ARTE, { recursive: true });
  appendFileSync(LOG, `\n--- corrida ${new Date().toISOString()} ---\n`);
  const salidas: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const host = new URL(frame.url()).hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') salidas.push(frame.url());
  });

  await page.goto('/wundeer');
  await expect(page.getByTestId('entrada-registro')).toBeVisible();
  await page.screenshot({ path: `${ARTE}/01-tablero-sin-sesion.png` });

  await page.getByTestId('entrada-registro').click();
  await expect(page.getByTestId('entrada-dialogo')).toBeVisible();
  await page.getByTestId('registro-nombre').fill('Rosa Prueba');
  await page.getByTestId('registro-correo').fill('rosa.prueba@ejemplo.test');
  await page.getByTestId('registro-enviar').click();
  await expect(page.getByText('Rosa Prueba').first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/wundeer\/?$/);
  anotar(`perfil ${sql("select email || ' team=' || is_team_member || ' rol=' || coalesce((select role_in_project from rr_hub_access a where a.user_id = p.id limit 1), 'ninguno') from rr_hub_profiles p where email = 'rosa.prueba@ejemplo.test'")}`);
  expect(sql("select is_team_member::text from rr_hub_profiles where email = 'rosa.prueba@ejemplo.test'")).toBe('false');
  expect(sql("select role_in_project from rr_hub_access a join rr_hub_profiles p on p.id = a.user_id where p.email = 'rosa.prueba@ejemplo.test'")).toBe('editor');
  await page.screenshot({ path: `${ARTE}/02-registro-rapido.png` });

  await expect(page.getByRole('link', { name: 'NUEVA PIEZA' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'NUEVA PIEZA' }).click();
  await expect(page).toHaveURL(/\/wundeer\/ideas\/nueva/);
  await page.locator('#idea-title').fill('Pieza que no sale de la pagina');
  await page.locator('#idea-objective').fill('Probar que el alta queda en la base');
  await page.locator('#idea-reference').fill('https://www.instagram.com/reel/pieza-local');
  await page.getByRole('button', { name: 'CREAR IDEA' }).click();
  await expect(page.getByTestId('idea-creada')).toBeVisible();
  await expect(page).toHaveURL(/\/wundeer\/ideas\/nueva/);
  const ideaId = sql("select id from rr_hub_ideas where title = 'Pieza que no sale de la pagina'");
  expect(ideaId).toMatch(/^[0-9a-f-]{36}$/);
  expect(sql(`select status from rr_hub_ideas where id = '${ideaId}'`)).toBe('voting');
  anotar(`idea ${ideaId} status voting`);
  await page.screenshot({ path: `${ARTE}/03-idea-creada.png` });

  await page.getByTestId('votar-si').click();
  await expect(page.getByTestId('seguimiento')).toContainText('Voto guardado');
  expect(sql(`select decision from rr_hub_votes where idea_id = '${ideaId}'`)).toBe('yes');
  anotar(`voto ${sql(`select voter_email || ' ' || decision from rr_hub_votes where idea_id = '${ideaId}'`)}`);
  await page.screenshot({ path: `${ARTE}/04-voto.png` });

  await page.getByTestId('guardar-guion').click();
  await expect(page.getByTestId('seguimiento')).toContainText('Guion guardado');
  expect(sql(`select count(*) from rr_hub_script_versions where idea_id = '${ideaId}'`)).toBe('1');
  expect(sql(`select left(script_content, 24) from rr_hub_ideas where id = '${ideaId}'`)).toContain('Gancho');
  anotar(`guion version ${sql(`select version_number::text from rr_hub_script_versions where idea_id = '${ideaId}'`)}`);
  await page.screenshot({ path: `${ARTE}/05-guion.png` });

  await page.getByTestId('comentario-texto').fill('Comentario que se queda en el hilo');
  await page.getByTestId('publicar-comentario').click();
  await expect(page.getByTestId('seguimiento')).toContainText('Comentario publicado');
  expect(sql(`select body from rr_hub_comments where idea_id = '${ideaId}'`)).toBe('Comentario que se queda en el hilo');
  anotar(`comentario ok`);
  await page.screenshot({ path: `${ARTE}/06-comentario.png` });

  const invitado = await browser.newContext();
  const paginaInvitado = await invitado.newPage();
  paginaInvitado.on('framenavigated', (frame) => {
    if (frame !== paginaInvitado.mainFrame()) return;
    const host = new URL(frame.url()).hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') salidas.push(frame.url());
  });
  await paginaInvitado.goto('/wundeer');
  await paginaInvitado.getByTestId('entrada-invitado').click();
  await expect(paginaInvitado.getByTestId('entrada-dialogo')).toBeVisible();
  await paginaInvitado.getByTestId('registro-nombre').fill('Lector Invitado');
  await paginaInvitado.getByTestId('invitado-entrar').click();
  await expect(paginaInvitado.getByText('Lector Invitado').first()).toBeVisible({ timeout: 15_000 });
  await expect(paginaInvitado).toHaveURL(/\/wundeer\/?$/);
  await expect(paginaInvitado.getByRole('link', { name: 'NUEVA PIEZA' })).toHaveCount(0);
  const filaInvitado = sql("select full_name || ' ' || email from rr_hub_profiles where email like 'invitado+%@invitados.hub'");
  expect(filaInvitado).toContain('Lector Invitado');
  expect(sql("select count(*) from rr_hub_access a join rr_hub_profiles p on p.id = a.user_id where p.email like 'invitado+%@invitados.hub'")).toBe('0');
  anotar(`invitado ${filaInvitado} sin acceso`);
  await paginaInvitado.screenshot({ path: `${ARTE}/07-invitado.png` });
  await invitado.close();

  expect(salidas, `el documento salio a: ${salidas.join(' ')}`).toEqual([]);
  anotar('sin redirecciones externas');
});
