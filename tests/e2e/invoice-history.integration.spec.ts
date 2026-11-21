import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('settings invoice history shows the authorized provider-unavailable state', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  const invoiceSection = page.locator('section[aria-labelledby="invoice-history-heading"]');
  await expect(invoiceSection).toBeVisible();
  await expect(invoiceSection.getByRole('status')).toContainText('Invoice history is unavailable in the free beta.');
  await expect(invoiceSection.getByRole('link', { name: 'Contact support' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('main').first()).toBeVisible();
});

test('invoice API rejects unauthenticated browser requests', async ({ request }) => {
  const response = await request.get('/api/billing/invoices?workspaceId=default');
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
});
