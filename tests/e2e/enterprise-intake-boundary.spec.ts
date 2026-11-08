import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps enterprise intake explicitly non-sending until an approved destination exists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  await page.getByLabel('Full Name').fill('Enterprise QA User');
  await page.getByLabel('Work Email').fill('enterprise@example.test');
  await page.getByLabel('Inquiry Type').selectOption('enterprise');
  await page.getByLabel('How can we help?').fill('This is a non-destructive local enterprise intake check.');

  const submit = page.getByRole('button', { name: 'Review inquiry state' });
  for (const field of [
    page.getByLabel('Full Name'),
    page.getByLabel('Work Email'),
    page.getByLabel('Inquiry Type'),
    page.getByLabel('How can we help?'),
    submit,
  ]) {
    expect((await field.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  await submit.click();
  const status = page.getByRole('status');
  await expect(status).toBeFocused();
  await expect(status).toContainText('No message was sent');
  await expect(status).toContainText('Contact intake is not connected to a delivery service in this beta.');
  await expect(page.getByRole('link', { name: /accepted|delivered|enterprise/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
