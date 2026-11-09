import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long reviewed compatibility metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/compatibility-proof', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        claimsAvailable: true, reason: null, changes: [{
          providerId: `provider-${'identifier-'.repeat(12)}`,
          changeId: `change-${'identifier-'.repeat(12)}`,
          title: `Breaking change ${'title-name-'.repeat(14)}`,
          changeType: `removed-${'change-type-'.repeat(8)}`,
          officialSourceUrl: 'https://example.test/source', publishedAt: '2026-11-10T00:00:00.000Z', effectiveAt: '2026-12-01', removalAt: null,
          severity: 'high', applicabilityScope: { dimensions: [`scope-${'dimension-'.repeat(10)}`] },
          affectedModels: [`model-${'name-'.repeat(12)}`], affectedResources: [`resource-${'name-'.repeat(12)}`],
          affectedResponseFields: [`field-${'name-'.repeat(12)}`], affectedEndpoints: [`/v1/${'endpoint-'.repeat(12)}`],
          affectedDomains: [`domain-${'name-'.repeat(12)}`], authOrHeaderPatterns: [`header-${'pattern-'.repeat(12)}`],
          affectedParameters: [`parameter-${'name-'.repeat(12)}`], replacement: { model: `replacement-${'model-'.repeat(10)}` },
          reviewer: `reviewer-${'name-'.repeat(10)}`, reviewedAt: '2026-11-10T00:00:00.000Z',
        }],
      }),
    });
  });

  await page.goto('/dashboard/compatibility', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('article')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long compatibility metadata').toEqual([]);
  await page.unroute('**/api/compatibility-proof');
});
