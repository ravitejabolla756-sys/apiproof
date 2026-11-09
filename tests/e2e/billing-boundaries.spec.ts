import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
  const invoiceSection = page.locator('section[aria-labelledby="invoice-history-heading"]');
  await expect(invoiceSection).toBeVisible();
  const invoiceStatus = invoiceSection.getByRole('status');
  await expect(invoiceStatus).toContainText('Invoice history is unavailable in the free beta.');
  await expect(invoiceStatus).toContainText('No provider-backed invoices or paid entitlements are represented here.');
  await expect(invoiceSection.getByRole('link')).toHaveCount(0);
  await expect(invoiceSection.getByRole('button')).toHaveCount(0);
  expect((await invoiceStatus.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'invoice history unavailable state').toEqual([]);
  const checkout = await page.request.post('/api/billing/checkout', { data: { planId: 'team' } });
  expect(checkout.status()).toBe(403);
  expect(await checkout.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });
  const portal = await page.request.post('/api/billing/portal');
  expect(portal.status()).toBe(403);
  expect(await portal.json()).toMatchObject({ error: expect.stringContaining('BILLING_NOT_AVAILABLE') });
});

test('keeps the invoice history boundary responsive across product breakpoints', async ({ page }) => {
  await signIn(page);
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    const invoiceSection = page.locator('section[aria-labelledby="invoice-history-heading"]');
    await expect(invoiceSection).toBeVisible({ timeout: 30_000 });
    await expect(invoiceSection.getByRole('status')).toContainText('Invoice history is unavailable in the free beta.');
    await expect(invoiceSection.getByRole('link')).toHaveCount(0);
    await expect(invoiceSection.getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${width}px billing overflow`).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, `${width}px invoice history`).toEqual([]);
  }
});

test('preserves keyboard skip-link focus on the invoice boundary', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Invoice history' })).toBeVisible({ timeout: 30_000 });
  const skipLink = page.locator('.skip-link').first();
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});
