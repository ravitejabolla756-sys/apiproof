import { expect, type Browser, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const localSeedPassword = process.env.APIPROOF_LOCAL_SEED_PASSWORD ?? 'local-test-seed-password';
let browserClientCounter = 0;

function nextBrowserClientIp(): string {
  browserClientCounter = (browserClientCounter % 254) + 1;
  return `198.51.100.${browserClientCounter}`;
}

export async function signIn(page: Page) {
  // Each test page models a separate browser client so the production rate
  // limiter is exercised without one CI runner IP exhausting the shared seed.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextBrowserClientIp() });
  await signInWithCredentials(page, 'developer@apiproof.dev', localSeedPassword);
}

export async function signInWithCredentials(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await page.waitForURL('**/dashboard');
}

export async function createLocalAccount(page: Page, email: string, password: string) {
  await page.goto('/login');
  const signupResult = await page.evaluate(async ({ signupEmail, signupPassword }) => {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', email: signupEmail, password: signupPassword, name: 'Browser Account' }),
    });
    return { status: response.status, body: await response.json() as { error?: string } };
  }, { signupEmail: email, signupPassword: password });
  expect(signupResult.status, signupResult.body.error).toBe(200);
  // The signup endpoint creates the authenticated session as part of account creation.
  // Navigate explicitly instead of submitting the login form again; the login page
  // redirects authenticated sessions before its form controls are available.
  await page.goto('/dashboard');
}

export async function withAcceptedInvitation(ownerPage: Page, browser: Browser, inviteEmail: string, action: (invitedPage: Page) => Promise<void>) {
  await ownerPage.goto('/dashboard/settings/workspace');
  await ownerPage.getByLabel('Invite email').fill(inviteEmail);
  await ownerPage.getByRole('button', { name: 'Create invite link' }).click();
  await expect(ownerPage.getByText('Invitation created. Copy the link and send it through an approved channel.')).toBeVisible({ timeout: 30_000 });

  const inviteUrl = await ownerPage.locator('code').filter({ hasText: '/invite/accept?token=' }).innerText();
  const invitedPage = await browser.newPage();
  try {
    const password = 'InviteePassword123!';
    await invitedPage.goto('/login');
    const signupResult = await invitedPage.evaluate(async ({ email, password: signupPassword }) => {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', email, password: signupPassword, name: 'Browser Invitee' }),
      });
      return { status: response.status, body: await response.json() as { error?: string } };
    }, { email: inviteEmail, password });
    expect(signupResult.status, signupResult.body.error).toBe(200);

    const parsedInviteUrl = new URL(inviteUrl, ownerPage.url());
    await invitedPage.goto(`${parsedInviteUrl.pathname}${parsedInviteUrl.search}`);
    await invitedPage.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(invitedPage.getByRole('status')).toContainText('You joined', { timeout: 30_000 });
    await action(invitedPage);
  } finally {
    await invitedPage.close();
  }
}

export async function scanAuthenticatedRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, route).toEqual([]);
  }
}

export async function assertDashboardRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
    if (route.includes('/repositories/')) {
      await expect(page.getByText('Repository not found or access denied.')).toBeVisible({ timeout: 30_000 });
      continue;
    }
    await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(overflow, 'mobile dashboard should not create document-level horizontal overflow').toBe(true);
}

export async function assertPublicRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('main#main-content'), route).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveTitle(/MY OWL/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /MY OWL/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
}
