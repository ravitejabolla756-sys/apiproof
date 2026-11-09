import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks provider-rule sample testing busy while the request is pending', async ({ page }) => {
  await signIn(page);
  const candidate = {
    id: 'candidate-action',
    providerId: 'fixture',
    title: 'Action loading candidate',
    description: 'Fixture candidate for action loading.',
    status: 'needs_review',
    severity: 'high',
    payload: { apiOperationPatterns: ['fixture.call'] },
    source: { url: 'https://fixture.test/change', type: 'official' },
    createdAt: '2026-11-07T00:00:00.000Z',
    reviewNotes: null,
    coverage: { priority: 'P1', reviewBlockers: [], evidenceClaims: 1, hasExecutableTemplate: false, nextAction: 'human-review' },
    reviewPack: null,
  };
  await page.route('**/api/provider-rules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [candidate], coverageSummary: { candidates: 1, pendingCandidates: 1, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } }),
    });
  });
  let releaseTest: (() => void) | undefined;
  const testPending = new Promise<void>((resolve) => { releaseTest = resolve; });
  await page.route('**/api/provider-rules/candidate-action/test', async (route) => {
    await testPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, matches: [{ token: 'fixture.call', line: 1, snippet: 'fixture.call()' }] }) });
  });
  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Action loading candidate' })).toBeVisible({ timeout: 30_000 });
  const sampleCode = page.getByRole('textbox', { name: 'Sample code for Action loading candidate' });
  await expect(sampleCode).toHaveCSS('font-size', '16px');
  await sampleCode.fill('fixture.call()');
  const testSample = page.getByRole('button', { name: 'Test sample' });
  await testSample.click();
  await expect(testSample).toHaveAttribute('aria-busy', 'true');
  releaseTest?.();
  await expect(testSample).not.toHaveAttribute('aria-busy');
  await expect(page.getByRole('status').filter({ hasText: '1 matching occurrence(s)' })).toBeVisible();
  await page.unroute('**/api/provider-rules/candidate-action/test');
  await page.unroute('**/api/provider-rules');
});
