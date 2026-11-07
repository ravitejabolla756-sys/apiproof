import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('recovers from an empty provider-rule priority filter', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/provider-rules', async (route) => {
    const candidate = {
      id: 'candidate-p1',
      providerId: 'fixture',
      title: 'P1 candidate',
      description: 'Fixture candidate for priority recovery.',
      status: 'needs_review',
      severity: 'high',
      payload: null,
      source: { url: 'https://fixture.test/change', type: 'official' },
      createdAt: '2026-11-07T00:00:00.000Z',
      reviewNotes: null,
      coverage: { priority: 'P1', reviewBlockers: [], evidenceClaims: 1, hasExecutableTemplate: false, nextAction: 'human-review' },
      reviewPack: null,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [candidate],
        coverageSummary: { candidates: 1, pendingCandidates: 1, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] },
      }),
    });
  });

  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Rule review' })).toBeVisible();
  const filter = page.getByRole('group', { name: 'Review priority filter' });
  const p0 = filter.getByRole('button', { name: 'P0 (0)' });
  await p0.focus();
  await expect(p0).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(p0).toHaveAttribute('aria-pressed', 'true');
  const filteredEmpty = page.getByRole('status').filter({ hasText: 'No candidates match this review priority.' });
  await expect(filteredEmpty).toBeVisible();
  await expect(filteredEmpty.getByRole('button', { name: 'Show all candidates' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'provider-rule filtered empty state').toEqual([]);

  const showAll = filteredEmpty.getByRole('button', { name: 'Show all candidates' });
  await showAll.focus();
  await expect(showAll).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'P1 candidate' })).toBeVisible();
  await page.unroute('**/api/provider-rules');
});
