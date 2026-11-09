import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long compatibility map metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/compatibility-map', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repositories: [{
        id: 'repo-map-long', owner: 'fixture', name: `repo-${'name-'.repeat(12)}`, fullName: `fixture/${'repository-name-'.repeat(12)}`,
        defaultBranch: `feature/${'branch-name-'.repeat(12)}`, latestScanStatus: 'completed',
        latestCompletedScan: { id: `scan-${'identifier-'.repeat(10)}`, sha: `${'a'.repeat(40)}`, baselineSha: null, filesAnalyzed: 12, findingsCount: 1, completedAt: '2026-11-10T00:00:00.000Z' },
        analysisEvidenceAvailable: true, openFindingCount: 1,
        integrations: [{ provider: 'fixture-provider', providerName: `Provider ${'name-'.repeat(12)}`, detected: true, usageCount: 12, mappedSymbolCount: 4, reviewedChangeCount: 1, resolvedVersion: `v${'1.2.3-'.repeat(8)}`, capability: 'compatibility' }],
        findings: [{ id: 'finding-map-long', provider: 'fixture-provider', title: `Finding ${'title-name-'.repeat(10)}`, status: 'open', filePath: `src/${'nested-directory-'.repeat(8)}client.ts`, symbol: `client.${'method-'.repeat(8)}`, migration: null, pullRequest: null }],
        compatibilityProofs: [{ changeId: `change-${'identifier-'.repeat(10)}`, providerId: `provider-${'identifier-'.repeat(10)}`, status: 'affected', changeTitle: `Proof ${'title-name-'.repeat(10)}`, exactFile: `src/${'nested-directory-'.repeat(8)}client.ts`, exactLine: 42, matchedEndpoint: `/${'endpoint-'.repeat(10)}` }],
      }] }),
    });
  });

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Show compatibility for repo-name/ })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long compatibility map metadata').toEqual([]);
  await page.unroute('**/api/compatibility-map');
});
