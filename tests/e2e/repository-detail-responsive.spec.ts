import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long repository detail metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route(/\/api\/repositories\/repo-detail-long(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repository: { id: 'repo-detail-long', owner: 'fixture', name: `repo-${'name-'.repeat(12)}`, full_name: `fixture/${'repository-name-'.repeat(12)}`, github_repository_id: `github-${'identifier-'.repeat(12)}`, default_branch: `feature/${'branch-name-'.repeat(12)}`, status: 'healthy', last_scan_at: null, created_at: '2026-11-10T00:00:00.000Z' },
        scans: [{ id: 'scan-detail-long', sha: 'a'.repeat(40), status: 'completed', files_analyzed: 12, findings_count: 1, started_at: '2026-11-10T00:00:00.000Z', completed_at: '2026-11-10T00:00:00.000Z' }],
        findings: [{ id: 'finding-detail-long', provider: `provider-${'name-'.repeat(10)}`, change_id: `change-${'identifier-'.repeat(10)}`, title: `Finding ${'title-name-'.repeat(12)}`, description: `Description ${'long-finding-description-'.repeat(16)}`, severity: 'high', confidence: 0.92, file_path: `src/${'nested-directory-'.repeat(8)}client.ts`, line_number: 42, symbol: `client.${'method-'.repeat(8)}`, status: 'open', created_at: '2026-11-10T00:00:00.000Z' }],
      }),
    });
  });

  await page.goto('/dashboard/repositories/repo-detail-long', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /repo-name/ })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long repository detail metadata').toEqual([]);
  await page.unroute(/\/api\/repositories\/repo-detail-long(?:\?.*)?$/);
});
