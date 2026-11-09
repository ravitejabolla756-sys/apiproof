import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps informational-route conversion links touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/cookies', '/privacy', '/terms', '/updates', '/contact']) {
    await page.goto(route);
    const link = page.getByRole('link', { name: 'Connect GitHub Free', exact: true });
    await expect(link, route).toBeVisible();
    expect((await link.boundingBox())?.height, route).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, route).toEqual([]);
  }
});

test('exposes the updates timeline as an ordered product-update list', async ({ page }) => {
  await page.goto('/updates');
  const updates = page.getByRole('list', { name: 'Product updates' });
  await expect(updates).toBeVisible();
  await expect(updates.locator(':scope > li')).toHaveCount(4);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});

test('keeps the public status page explicit while no monitor is connected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/status');

  await expect(page.getByRole('heading', { name: 'A truthful status surface is coming.' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('No live monitor is connected');
  const supportLink = page.getByRole('link', { name: 'Contact support' });
  await expect(supportLink).toHaveAttribute('href', '/contact');
  expect((await supportLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});

test('keeps the public not-found recovery links valid on mobile', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/route-that-does-not-exist');
  expect(response?.status()).toBe(404);
  for (const label of ['Return Home', 'Explore Features']) {
    const link = page.getByRole('link', { name: label, exact: true });
    const href = await link.getAttribute('href');
    expect(href, label).toBeTruthy();
    const target = await request.get(href!);
    expect(target.status(), href ?? label).toBeLessThan(400);
    expect((await link.boundingBox())?.height, label).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});

test('keeps the shared footer brand and navigation links touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog');

  const footer = page.getByRole('contentinfo');
  const links = footer.getByRole('link');
  await expect(links).toHaveCount(18);
  for (let index = 0; index < await links.count(); index += 1) {
    const link = links.nth(index);
    expect((await link.boundingBox())?.height, await link.innerText()).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('footer').analyze()).violations).toEqual([]);
});
