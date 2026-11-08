import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

test('collapsed sidebar keeps the MY OWL brand link named', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard');

  const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
  const collapse = sidebar.getByRole('button', { name: 'Collapse workspace navigation' });
  expect((await collapse.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await collapse.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  await collapse.click();

  await expect(sidebar.getByRole('link', { name: 'MY OWLv0.7 dashboard' })).toBeVisible();
});
