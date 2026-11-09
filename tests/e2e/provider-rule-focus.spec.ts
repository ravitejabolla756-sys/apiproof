import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test.describe('provider-rule recovery focus', () => {
  test('preserves explicit skip-link focus on a provider-rule error', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/provider-rules', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Provider rules are temporarily unavailable.' }),
      });
    });

    await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
    const alert = page.getByRole('alert').filter({ hasText: 'Provider rules are temporarily unavailable.' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations).toEqual([]);

    const skipLink = page.locator('.skip-link').first();
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await page.unroute('**/api/provider-rules');
  });
});
