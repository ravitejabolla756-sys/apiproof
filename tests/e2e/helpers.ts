import { expect, type Page } from '@playwright/test';

let signInSequence = 0;

export async function signIn(page: Page) {
  const forwardedIp = `198.51.100.${(signInSequence++ % 250) + 1}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': forwardedIp });
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
