import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('public auth-entry state announcements', () => {
  test('announces a missing verification token as an actionable error', async ({ page }) => {
    await page.goto('/verify-email');
    const alert = page.getByRole('alert').filter({ hasText: 'This verification link is missing its token.' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    const signInLink = page.getByRole('link', { name: 'Continue to sign in' });
    await expect(signInLink).toBeVisible();
    expect((await signInLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
  });

  test('announces invitation acceptance failures and preserves sign-in recovery', async ({ page }) => {
    let releaseResponse!: () => void;
    const responseReleased = new Promise<void>((resolve) => { releaseResponse = resolve; });
    await page.route('**/api/workspace/invitations/accept', async (route) => {
      await responseReleased;
      await route.fulfill({ status: 410, contentType: 'application/json', body: JSON.stringify({ error: 'This invitation has expired.' }) });
    });
    await page.goto('/invite/accept?token=expired-token');
    const acceptInvitation = page.getByRole('button', { name: 'Accept invitation' });
    expect((await acceptInvitation.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await acceptInvitation.focus();
    await expect(acceptInvitation).toBeFocused();
    await page.keyboard.press('Enter');
    const progress = page.getByRole('status').filter({ hasText: 'Accepting invitation…' });
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('aria-busy', 'true');
    releaseResponse();
    const alert = page.getByRole('alert').filter({ hasText: 'This invitation has expired.' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    const recoveryLink = page.getByRole('link', { name: 'Sign in with the invited account' });
    await expect(recoveryLink).toBeVisible();
    expect((await recoveryLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
    await page.unroute('**/api/workspace/invitations/accept');
  });
});
