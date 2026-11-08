import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('announces findings trend segment counts to assistive technology', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/overview', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { findingsThisWeek?: unknown[] };
    body.findingsThisWeek = [{ day: '2026-11-08', total: 6, critical: 1, high: 2, warning: 3 }];
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Findings this week' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('img', { name: '6 findings on 2026-11-08: 1 critical, 2 high, 3 warning' })).toBeVisible();
  await page.unroute('**/api/overview');
});
