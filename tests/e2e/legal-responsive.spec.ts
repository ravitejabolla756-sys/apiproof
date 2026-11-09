import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const legalRoutes = [
  { draft: true, route: '/privacy', heading: 'Privacy Policy' },
  { draft: true, route: '/terms', heading: 'Terms & Conditions' },
  { draft: true, route: '/refunds', heading: 'Billing and refunds' },
  { draft: false, route: '/cookies', heading: 'Cookie Policy' },
] as const;

test('keeps public legal pages readable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });

  for (const { draft, route, heading } of legalRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (draft) {
      await expect(page.getByTestId('legal-draft-metadata')).toHaveText(
        'Draft version 0.1 · Effective date: pending owner/legal approval',
      );
    } else {
      await expect(page.getByText('Last updated: March 2026 · Effective immediately')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);

    const audit = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(audit.violations, route).toEqual([]);

    if (route === '/refunds') {
      for (const link of [
        page.getByRole('link', { name: 'contact page' }),
        page.getByRole('link', { name: 'Review beta pricing language' }),
      ]) {
        expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
