import { expect, test, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

async function expectTouchSized(locator: Locator, label: string) {
  await expect(locator.first(), label).toBeVisible();
  for (let index = 0; index < await locator.count(); index += 1) {
    expect((await locator.nth(index).boundingBox())?.height, `${label} #${index + 1}`).toBeGreaterThanOrEqual(44);
  }
}

test('keeps authenticated settings controls touch-sized on mobile', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/dashboard/settings');
  await expectTouchSized(page.getByRole('link', { name: 'Account settings', exact: true }), 'Account settings');
  await expectTouchSized(page.getByRole('link', { name: 'Workspace administration', exact: true }), 'Workspace administration');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  await page.goto('/dashboard/settings/account');
  await expectTouchSized(page.getByRole('link', { name: 'Workspace settings', exact: true }), 'Account back link');
  for (const label of ['Display name', 'Current password', 'New password', 'Confirm new password']) {
    await expectTouchSized(page.getByLabel(label), label);
  }
  await expectTouchSized(page.getByRole('button', { name: 'Save profile', exact: true }), 'Save profile');
  await expectTouchSized(page.getByRole('button', { name: 'Update password', exact: true }), 'Update password');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  await page.goto('/dashboard/settings/workspace');
  await expectTouchSized(page.getByRole('link', { name: 'Workspace settings', exact: true }), 'Workspace back link');
  for (const label of ['Name', 'Slug', 'Invite email']) {
    await expectTouchSized(page.getByLabel(label), label);
  }
  for (const label of ['Save workspace', 'Create invite link']) {
    await expectTouchSized(page.getByRole('button', { name: label, exact: true }), label);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  await page.goto('/dashboard/settings/notifications');
  await expectTouchSized(page.getByRole('link', { name: 'Workspace settings', exact: true }), 'Notification back link');
  await expectTouchSized(page.locator('label:has(input[type="checkbox"])'), 'Notification preferences');
  await expectTouchSized(page.getByRole('button', { name: 'Save preferences', exact: true }), 'Save preferences');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
