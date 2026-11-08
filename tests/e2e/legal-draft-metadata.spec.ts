import { expect, test } from '@playwright/test';

test('marks legal and refund pages as versioned drafts pending approval', async ({ page }) => {
  for (const route of ['/privacy', '/terms', '/refunds']) {
    await page.goto(route);
    const metadata = page.getByTestId('legal-draft-metadata');
    await expect(metadata, route).toHaveText('Draft version 0.1 · Effective date: pending owner/legal approval');
    await expect(metadata, route).toBeVisible();
  }
});
