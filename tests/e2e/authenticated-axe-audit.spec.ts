import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

const authenticatedRoutes = [
  '/dashboard', '/dashboard/activity', '/dashboard/compatibility', '/dashboard/repositories',
  '/dashboard/findings', '/dashboard/migrations', '/dashboard/pull-requests', '/dashboard/providers',
  '/dashboard/inventory', '/dashboard/rules/pending', '/dashboard/settings',
  '/dashboard/settings/account', '/dashboard/settings/notifications', '/dashboard/settings/workspace',
  '/dashboard/findings/not-a-real-finding',
];

test('keeps the audited authenticated routes free of axe violations', async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page);
  for (const route of authenticatedRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('#main-content'), route).toBeVisible({ timeout: 30_000 });
    const violations = (await new AxeBuilder({ page }).include('#main-content').analyze()).violations;
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), route).toEqual([]);
  }
});
