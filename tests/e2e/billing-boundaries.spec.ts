import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps beta billing boundaries truthful in browser flows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pricing');
  await expect(page.getByText('Paid plans are visible while they roll out, but cannot be purchased yet.')).toBeVisible();
  await expect(page.getByText('Rolling out — no checkout')).toBeVisible();
  await expect(page.getByText('Coming soon — no checkout')).toBeVisible();
  for (const label of ['Get Started', 'Start an enterprise inquiry']) {
    expect((await page.getByRole('link', { name: label }).boundingBox())?.height, label).toBeGreaterThanOrEqual(44);
  }

  await signIn(page);
  await page.goto('/dashboard/settings');
  await expect(page.getByRole('link', { name: 'View paid-plan rollout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invoice history' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Invoice history is unavailable in the free beta.' })).toBeVisible();
  const checkout = await page.request.post('/api/billing/checkout', { data: { planId: 'team' } });
  expect(checkout.status()).toBe(403);
  expect(await checkout.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });
  const portal = await page.request.post('/api/billing/portal');
  expect(portal.status()).toBe(403);
  expect(await portal.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });
});
