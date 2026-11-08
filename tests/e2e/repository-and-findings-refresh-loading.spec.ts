import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks findings and repository refresh controls busy while requests are pending', async ({ page }) => {
  await signIn(page);

  let releaseFindings: (() => void) | undefined;
  const findingsPending = new Promise<void>((resolve) => { releaseFindings = resolve; });
  await page.route('**/api/findings', async (route) => {
    await findingsPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ findings: [] }) });
  });
  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
  const findingsRefresh = page.getByRole('button', { name: 'Refresh' });
  await expect(findingsRefresh).toBeDisabled();
  await expect(findingsRefresh).toHaveAttribute('aria-busy', 'true');
  releaseFindings?.();
  await expect(page.getByText('No compatibility findings detected')).toBeVisible({ timeout: 30_000 });
  await expect(findingsRefresh).not.toBeDisabled();
  await expect(findingsRefresh).not.toHaveAttribute('aria-busy');
  await page.unroute('**/api/findings');

  let releaseRepositories: (() => void) | undefined;
  const repositoriesPending = new Promise<void>((resolve) => { releaseRepositories = resolve; });
  await page.route('**/api/repositories', async (route) => {
    await repositoriesPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
  });
  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  const repositoriesRefresh = page.getByRole('button', { name: 'Refresh' });
  await expect(repositoriesRefresh).toBeDisabled();
  await expect(repositoriesRefresh).toHaveAttribute('aria-busy', 'true');
  releaseRepositories?.();
  await expect(page.getByText('No repositories connected yet.')).toBeVisible({ timeout: 30_000 });
  await expect(repositoriesRefresh).not.toBeDisabled();
  await expect(repositoriesRefresh).not.toHaveAttribute('aria-busy');
  await page.unroute('**/api/repositories');

  const detailPayload = { repository: { id: 'repo-refresh-loading', owner: 'acme', name: 'owl', full_name: 'acme/owl', github_repository_id: 'gh-refresh-loading', default_branch: 'main', status: 'healthy', last_scan_at: null, created_at: '2026-11-07T00:00:00.000Z' }, scans: [], findings: [] };
  await page.route(/\/api\/repositories\/repo-refresh-loading(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailPayload) });
  });
  await page.goto('/dashboard/repositories/repo-refresh-loading', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'owl', exact: true })).toBeVisible({ timeout: 30_000 });

  let releaseDetails: (() => void) | undefined;
  const detailsPending = new Promise<void>((resolve) => { releaseDetails = resolve; });
  await page.unroute(/\/api\/repositories\/repo-refresh-loading(?:\?.*)?$/);
  await page.route(/\/api\/repositories\/repo-refresh-loading(?:\?.*)?$/, async (route) => {
    await detailsPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailPayload) });
  });
  const detailsRefresh = page.getByRole('button', { name: 'Refresh' });
  await detailsRefresh.click();
  await expect(detailsRefresh).toBeDisabled();
  await expect(detailsRefresh).toHaveAttribute('aria-busy', 'true');
  releaseDetails?.();
  await expect(page.getByRole('heading', { name: 'owl', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(detailsRefresh).not.toBeDisabled();
  await expect(detailsRefresh).not.toHaveAttribute('aria-busy');
  await page.unroute(/\/api\/repositories\/repo-refresh-loading(?:\?.*)?$/);
});
