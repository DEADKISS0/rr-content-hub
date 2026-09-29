import { test } from '@playwright/test';
test('probe', async ({ page }) => {
  await page.goto('/wundeer/ideas/nueva');
  await page.waitForLoadState('networkidle');
  console.log('FINAL_URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('H1:', await page.locator('h1').allInnerTexts());
  console.log('BUTTONS:', await page.getByRole('button').allInnerTexts());
  console.log('BODY_HEAD:', (await page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,400));
});
