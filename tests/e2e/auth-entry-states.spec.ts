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

  test('fails closed when email verification returns a malformed success payload', async ({ page }) => {
    await page.route('**/api/auth', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Looks successful but is missing the success marker.' }) });
    });
    await page.goto('/verify-email#token=malformed-response-token');
    const alert = page.getByRole('alert').filter({ hasText: 'This verification link is invalid or expired.' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
    await page.unroute('**/api/auth');
  });

  test('does not expose invitation acceptance without a token', async ({ page }) => {
    await page.goto('/invite/accept');
    await expect(page.getByRole('alert').filter({ hasText: 'This invitation link is missing its token.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
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
    await expect(progress).toBeFocused();
    releaseResponse();
    const alert = page.getByRole('alert').filter({ hasText: 'This invitation has expired.' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    await expect(alert).toBeFocused();
    const recoveryLink = page.getByRole('link', { name: 'Sign in with the invited account' });
    await expect(recoveryLink).toBeVisible();
    expect((await recoveryLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
    await page.unroute('**/api/workspace/invitations/accept');
  });

  test('turns invitation network failures into a focused recovery state', async ({ page }) => {
    await page.route('**/api/workspace/invitations/accept', async (route) => {
      await route.abort('failed');
    });
    await page.goto('/invite/accept?token=network-failure-token');
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Unable to reach the invitation service.' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(page.getByRole('link', { name: 'Sign in with the invited account' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
    await page.unroute('**/api/workspace/invitations/accept');
  });

  test('fails closed when invitation acceptance returns a malformed success payload', async ({ page }) => {
    await page.route('**/api/workspace/invitations/accept', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspace: { name: 42 } }) });
    });
    await page.goto('/invite/accept?token=malformed-response-token');
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Unable to accept this invitation.' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(page.getByRole('link', { name: 'Sign in with the invited account' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
    await page.unroute('**/api/workspace/invitations/accept');
  });
});
