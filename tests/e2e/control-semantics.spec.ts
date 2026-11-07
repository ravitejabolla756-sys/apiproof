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
});
