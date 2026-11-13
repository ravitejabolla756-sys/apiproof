import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

const dashboardRoutes = [
  { path: '/dashboard/migrations', api: '/api/migrations' },
  { path: '/dashboard/repositories', api: '/api/repositories' },
  { path: '/dashboard/inventory', api: '/api/inventory' },
] as const;

for (const { path, api } of dashboardRoutes) {
  test(`${path} loads after authenticated API response`, async ({ page }) => {
    await signIn(page);

    const apiResponse = page.waitForResponse((response) => {
      return response.url().includes(api) && response.request().method() === 'GET';
    });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const response = await apiResponse;

    expect(response.status(), `${api} response`).toBeLessThan(500);
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByText('Checking your session…')).toHaveCount(0);
  });
}

test('workspace-scoped API rejects an inaccessible workspace without hanging', async ({ page }) => {
  await signIn(page);
  const response = await page.request.get('/api/billing/invoices?workspaceId=workspace-not-accessible');
  // The route deliberately uses a not-found-shaped response for cross-tenant
  // access so it does not disclose whether a workspace exists.
  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toMatchObject({ code: 'WORKSPACE_ACCESS_DENIED' });
});
