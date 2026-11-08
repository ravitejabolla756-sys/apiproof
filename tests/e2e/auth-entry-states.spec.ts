import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('public auth-entry state announcements', () => {
  test('announces a missing verification token as an actionable error', async ({ page }) => {
    await page.goto('/verify-email');
    const alert = page.getByRole('alert').filter({ hasText: 'This verification link is missing its token.' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    await expect(page.getByRole('link', { name: 'Continue to sign in' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
  });

  test('announces invitation acceptance failures and preserves sign-in recovery', async ({ page }) => {
    await page.route('**/api/workspace/invitations/accept', async (route) => {
      await route.fulfill({ status: 410, contentType: 'application/json', body: JSON.stringify({ error: 'This invitation has expired.' }) });
    });
    await page.goto('/invite/accept?token=expired-token');
    const acceptInvitation = page.getByRole('button', { name: 'Accept invitation' });
    await acceptInvitation.focus();
    await expect(acceptInvitation).toBeFocused();
    await page.keyboard.press('Enter');
    const alert = page.getByRole('alert').filter({ hasText: 'This invitation has expired.' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    await expect(page.getByRole('link', { name: 'Sign in with the invited account' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
    await page.unroute('**/api/workspace/invitations/accept');
  });
});
