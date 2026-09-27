import { test, expect } from '@playwright/test';

const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
const PROYECTO = 'wundeer';
const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');

test.describe('asignar responsable', () => {
  test('el bloque nombra a alguien real del roster y explica el hueco', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    const bloque = page.getByRole('complementary').or(page.locator('aside'));
    // El bloque tiene que existir siempre, tenga o no responsable.
    await expect(page.getByText('// RESPONSABLE DE LA PIEZA').or(page.getByText('// RESPONSABLE'))).toBeVisible();

    // Sin responsable, el select ofrece el roster real, con nombre y rol.
    const select = page.getByLabel('// QUIÉN RESPONDE');
    if (await select.count()) {
      const opciones = await select.locator('option').allInnerTexts();
      expect(opciones.length, 'el roster de Wundeer tiene 16 personas').toBeGreaterThan(5);
      // Ninguna opción puede decir "sin sesión": es una persona, no un rol roto.
      expect(opciones.join(' ')).not.toContain('sin sesión');
      // Y el botón no se habilita hasta elegir: no se deshabilita por algo invisible.
      await expect(page.getByRole('button', { name: /ASIGNAR RESPONSABLE/ })).toBeDisabled();
    }
  });

  test('no promete una transición de rol: asignar no cambia la fase', async ({ page }) => {
    await page.addInitScript(visto);
    await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });

    // Asignar un responsable es metadata, no un cambio de estado. Si alguien lo
    // metió en `allowedTransitions()`, aparecería un estado nuevo en el flujo de
    // 13 y esta aserción lo delataría.
    const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
    if (await grupo.isVisible().catch(() => false)) {
      const botones = await grupo.getByRole('button').allInnerTexts();
      expect(botones.join(' ')).not.toMatch(/ASIGNAR RESPONSABLE/i);
    }
  });
});
