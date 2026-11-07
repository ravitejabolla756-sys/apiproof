import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('wraps findings filters for multi-provider mobile results', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  await page.route('**/api/findings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        findings: ['github', 'stripe', 'slack', 'twilio'].map((provider, index) => ({
          id: `finding-${provider}`,
          provider,
          change_id: `rule-${provider}`,
          title: `${provider} compatibility finding`,
          description: 'A fixture finding used to verify responsive filter recovery.',
          severity: index % 2 === 0 ? 'high' : 'critical',
          confidence: '0.9',
          file_path: 'src/integration.ts',
          line_number: index + 1,
          symbol: `call${index + 1}`,
          status: 'open',
          created_at: '2026-11-08T00:00:00.000Z',
          repo_name: 'fixture-repository',
          repo_full_name: 'fixture/fixture-repository',
          pr_number: null,
          pr_url: null,
          pr_state: null,
          capability: { migrationAvailable: false, recommendedNextAction: 'MANUAL_REVIEW' },
        })),
      }),
    });
  });

  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'API Compatibility Findings' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('group', { name: 'Filter by provider' }).getByRole('button')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
