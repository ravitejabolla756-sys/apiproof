import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '198.51.100.10' });
  await page.goto('/login');
  await page.getByLabel('Email').fill('developer@apiproof.dev');
  await page.getByLabel('Password').fill(process.env.APIPROOF_LOCAL_SEED_PASSWORD ?? 'local-test-seed-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await page.waitForURL('**/dashboard');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const authResponse = await page.request.get('/api/auth');
  expect(authResponse.status()).toBe(200);
  await expect(page.getByText('Checking your session…')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('main').first()).toBeVisible();
}
