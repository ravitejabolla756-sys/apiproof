import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long finding detail metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/findings/finding-detail-long', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        finding: {
          id: 'finding-detail-long', provider: `provider-${'name-'.repeat(10)}`, change_id: `change-${'identifier-'.repeat(10)}`,
          title: `Finding ${'title-name-'.repeat(12)}`, description: `Description ${'long-finding-description-'.repeat(18)}`,
          severity: 'high', confidence: 'high', file_path: `src/${'nested-directory-'.repeat(8)}client.ts`, line_number: 42,
          symbol: `client.${'method-'.repeat(8)}`, reason: `Reason ${'long-reason-'.repeat(12)}`, source_snippet: 'client.call()', status: 'open',
          created_at: '2026-11-10T00:00:00.000Z', repo_name: `repo-${'name-'.repeat(10)}`, repo_full_name: `fixture/${'repository-name-'.repeat(10)}`,
          repo_owner: 'fixture', default_branch: `feature/${'branch-name-'.repeat(10)}`, evidence: [], reasonCodes: [], capability: null,
        },
        migration: null,
      }),
    });
  });

  await page.goto('/dashboard/findings/finding-detail-long', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Finding title-name/ })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long finding detail metadata').toEqual([]);
  await page.unroute('**/api/findings/finding-detail-long');
});
