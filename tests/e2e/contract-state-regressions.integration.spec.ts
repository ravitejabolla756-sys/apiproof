import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('compatibility failures remain visible as a retryable error state', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/compatibility-proof', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unavailable' }),
    });
  });

  await page.goto('/dashboard/compatibility', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Compatibility records cannot be displayed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByText('No reviewed compatibility claims are available', { exact: true })).toHaveCount(0);
});

test('unauthorized repository detail responses use the safe not-found state', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/repositories/not-authorized', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
  });

  await page.goto('/dashboard/repositories/not-authorized', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Repository not found or access denied.', { exact: true })).toBeVisible();
  await expect(page.getByText('Repository details are temporarily unavailable.', { exact: true })).toHaveCount(0);
});

test('unauthorized finding detail responses use the safe not-found state', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/findings/not-authorized', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
  });

  await page.goto('/dashboard/findings/not-authorized', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Finding not found or access denied.', { exact: true })).toBeVisible();
  await expect(page.getByText('Finding details are temporarily unavailable.', { exact: true })).toHaveCount(0);
});

test('login failures are announced to assistive technology', async ({ page }) => {
  const authCheck = page.waitForResponse((response) => response.url().endsWith('/api/auth') && response.request().method() === 'GET');
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await authCheck;
  await page.route('**/api/auth', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid email or password.' }),
    });
  });

  await page.getByLabel('Email').fill('invalid@example.test');
  await page.getByLabel('Password').fill('wrong-password');
  await expect(page.getByLabel('Email')).toHaveValue('invalid@example.test');
  await expect(page.getByLabel('Password')).toHaveValue('wrong-password');
  const authResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth') && response.request().method() === 'POST');
  await page.locator('form button[type="submit"]').click();
  expect((await authResponse).status()).toBe(401);

  await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible();
});

test('findings filters distinguish zero matches from an empty workspace', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/findings', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        findings: [{
          id: 'finding-filter-fixture',
          provider: 'stripe',
          change_id: 'stripe-fixture-change',
          title: 'Fixture finding',
          description: 'A deterministic fixture finding.',
          severity: 'high',
          confidence: 0.9,
          file_path: 'src/payment.ts',
          line_number: 12,
          symbol: 'stripe.charge',
          status: 'detected',
          created_at: '2026-11-22T00:00:00.000Z',
          repo_name: 'fixture-repository',
          repo_full_name: 'apiproof/fixture-repository',
          pr_number: null,
          pr_url: null,
          pr_state: null,
          capability: null,
        }],
      }),
    });
  });

  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Search findings').fill('does-not-match');

  await expect(page.getByText('No findings match the selected filters', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toBeVisible();
  await expect(page.getByText('No compatibility findings detected', { exact: true })).toHaveCount(0);
});

test('failed scan history rows use failure styling', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/repositories/failed-repository', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repository: {
          id: 'failed-repository',
          owner: 'apiproof',
          name: 'failed-repository',
          full_name: 'apiproof/failed-repository',
          github_repository_id: '54321',
          default_branch: 'main',
          status: 'connected',
          last_scan_at: '2026-11-22T00:00:00.000Z',
          created_at: '2026-11-21T00:00:00.000Z',
        },
        scans: [{
          id: 'scan-failed-fixture',
          sha: '0123456789abcdef',
          status: 'failed',
          files_analyzed: 0,
          findings_count: 0,
          started_at: '2026-11-22T00:00:00.000Z',
          completed_at: null,
        }],
        findings: [],
      }),
    });
  });

  await page.goto('/dashboard/repositories/failed-repository', { waitUntil: 'domcontentloaded' });

  const failedStatus = page.locator('td').getByText('failed', { exact: true });
  await expect(failedStatus).toHaveClass(/border-rose-200/);
  await expect(page.getByText('Scan Failed', { exact: true })).toBeVisible();
});
