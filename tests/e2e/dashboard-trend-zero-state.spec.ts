import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps zero-valued findings trend bars finite and accessible', async ({ page }) => {
  await page.route('**/api/overview', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { findingsThisWeek?: unknown[] };
    body.findingsThisWeek = [{ day: '2026-11-09', total: 0, critical: 0, high: 0, warning: 0 }];
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await signIn(page);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const trend = page.getByRole('img', { name: /0 findings on/ });
  await expect(trend).toBeVisible();
  const segmentStyles = await trend.locator('div > span').evaluateAll((elements) => elements.map((element) => (element as HTMLElement).style.width));
  expect(segmentStyles).toEqual(['0%', '0%', '0%']);
  expect(segmentStyles.some((value) => value.includes('NaN'))).toBe(false);
  await page.unroute('**/api/overview');
});
