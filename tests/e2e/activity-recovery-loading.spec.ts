import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps activity recovery visible and busy while the retry is pending', async ({ page }) => {
  await signIn(page);
  let requests = 0;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });

  await page.route('**/api/activity', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Activity is temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activities: [] }) });
  });

  await page.goto('/dashboard/activity', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Activity is temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });

  const retry = alert.getByRole('button', { name: 'Try again' });
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');

  releaseRecovery?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'No activity recorded yet' })).toBeVisible({ timeout: 30_000 });
  expect(requests).toBeGreaterThanOrEqual(2);
  await page.unroute('**/api/activity');
});

test('contains long activity text on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);
  await page.route('**/api/activity', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activities: [{
        id: 'long-activity',
        type: 'scan_completed',
        title: 'A'.repeat(180),
        description: 'Description '.repeat(40),
        created_at: '2026-11-10T00:00:00.000Z',
      }] }),
    });
  });
  await page.goto('/dashboard/activity');
  await expect(page.getByText('A'.repeat(180), { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long activity text').toEqual([]);
  await page.unroute('**/api/activity');
});
