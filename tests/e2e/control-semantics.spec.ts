import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('dashboard interactive controls expose explicit button semantics', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Search repos, findings, SDKs/ }).click();
  const palette = page.getByRole('dialog', { name: 'Search MY OWL' });
  await expect(palette).toBeVisible();
  for (const button of await palette.getByRole('button').all()) await expect(button).toHaveAttribute('type', 'button');
  await page.keyboard.press('Escape');

  await page.goto('/dashboard/findings');
  const severityFilters = page.getByRole('group', { name: 'Filter by severity' }).getByRole('button');
  await expect(severityFilters).not.toHaveCount(0);
  for (const button of await severityFilters.all()) await expect(button).toHaveAttribute('type', 'button');

  await page.route('**/api/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [{ id: 'repo-semantics', owner: 'acme', name: 'owl', full_name: 'acme/owl', github_repository_id: 'gh-1', default_branch: 'main', status: 'healthy', last_scan_at: null, created_at: '2026-11-07T00:00:00.000Z', findings_count: 0, scans_count: 0, last_scan_sha: null }] }) });
  });
  await page.goto('/dashboard/repositories');
  const expander = page.getByRole('button', { name: 'Collapse owl' });
  await expect(expander).toHaveAttribute('type', 'button');
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  await expander.click();
  await expect(page.getByRole('button', { name: 'Expand owl' })).toHaveAttribute('aria-expanded', 'false');
  await page.unroute('**/api/repositories');
});

test('dashboard findings trend bars expose accessible graphics', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/overview', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { findingsThisWeek?: unknown[] };
    body.findingsThisWeek = [{ day: '2026-11-07', total: 3, critical: 1, high: 1, warning: 1 }];
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await page.goto('/dashboard');
  const trendBars = page.getByRole('img', { name: /findings on/ });
  await expect(trendBars).not.toHaveCount(0);
  for (const bar of await trendBars.all()) await expect(bar).toHaveAttribute('aria-label', /findings on/);
  await page.unroute('**/api/overview');
});

test('audited dashboard routes do not nest interactive elements', async ({ page }) => {
  await signIn(page);
  for (const route of ['/dashboard', '/dashboard/findings', '/dashboard/migrations', '/dashboard/pull-requests', '/dashboard/repositories']) {
    await page.goto(route);
    await expect(page.locator('main#main-content')).toBeVisible();
    const nestedInteractiveCount = await page.locator('a button, a input, a select, a textarea, button a, button input, button select, button textarea, [role="link"] [role="button"], [role="button"] [role="link"]').count();
    expect(nestedInteractiveCount, `${route} contains nested interactive elements`).toBe(0);
  }
});

test('dashboard links and controls expose visible keyboard focus', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard');

  for (const control of [
    page.getByRole('link', { name: 'Repositories', exact: true }).first(),
    page.getByRole('button', { name: /Search repos, findings, SDKs/ }),
  ]) {
    await control.focus();
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS('outline-style', 'solid');
    await expect(control).toHaveCSS('outline-width', '3px');
  }
});
