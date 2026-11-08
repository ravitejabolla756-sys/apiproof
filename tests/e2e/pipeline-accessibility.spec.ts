import { expect, test } from '@playwright/test';

test('exposes accessible pipeline stage navigation', async ({ page }) => {
  await page.goto('/');
  const stageButtons = page.getByRole('button', { name: /Jump to stage/ });
  await expect(stageButtons).toHaveCount(4);
  await expect(stageButtons.first()).toHaveAttribute('type', 'button');
  await stageButtons.first().focus();
  await expect(stageButtons.first()).toBeFocused();
  await expect(stageButtons.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(stageButtons.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await stageButtons.nth(1).focus();
  await expect(stageButtons.nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(stageButtons.nth(1)).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
  await expect(stageButtons.first()).toHaveAttribute('aria-pressed', 'false');
  for (let index = 0; index < await stageButtons.count(); index += 1) {
    const box = await stageButtons.nth(index).boundingBox();
    expect(box?.height, `stage ${index + 1} height`).toBeGreaterThanOrEqual(44);
    expect(box?.width, `stage ${index + 1} width`).toBeGreaterThanOrEqual(44);
  }
});
