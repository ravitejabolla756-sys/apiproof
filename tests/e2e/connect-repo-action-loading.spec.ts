import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks repository connection submit busy while the request is pending', async ({ page }) => {
  await signIn(page);

  let releaseConnect: (() => void) | undefined;
  const connectPending = new Promise<void>((resolve) => { releaseConnect = resolve; });
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: true, repositories: [{ id: 'repo-connect-loading', name: 'owl', fullName: 'fixture/owl', owner: 'fixture', defaultBranch: 'main', private: false }] }),
    });
  });
  await page.route('**/api/repositories**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/repositories' && route.request().method() === 'POST') {
      await connectPending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, repository: { id: 'repo-connect-loading' } }) });
      return;
    }
    if (pathname.endsWith('/scan')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, result: { findingsCount: 0 } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
  });

  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Connect repository', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
  await expect(dialog.getByRole('radio', { name: 'Select fixture/owl' })).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('radio', { name: 'Select fixture/owl' }).check();

  const submit = dialog.locator('button[type="submit"]');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('aria-busy', 'true');

  releaseConnect?.();
  await expect(dialog.getByRole('status').filter({ hasText: 'Initial scan completed' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/github/repositories');
});
