import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps beta billing boundaries truthful in browser flows', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Paid plans are visible while they roll out, but cannot be purchased yet.')).toBeVisible();
  await expect(page.getByText('Rolling out — no checkout')).toBeVisible();
  await expect(page.getByText('Coming soon — no checkout')).toBeVisible();

  await signIn(page);
  const checkout = await page.request.post('/api/billing/checkout', { data: { planId: 'team' } });
  expect(checkout.status()).toBe(403);
  expect(await checkout.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });
  const portal = await page.request.post('/api/billing/portal');
  expect(portal.status()).toBe(403);
  expect(await portal.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });
});
