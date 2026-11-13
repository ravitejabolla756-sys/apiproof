import { expect } from '@playwright/test';

export default async function globalSetup() {
  const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100');
  const baseUrl = `http://127.0.0.1:${port}`;
  // Compile every authenticated dashboard route used by the smoke suite before
  // browser navigation begins. This removes first-navigation compilation from
  // the timing-sensitive assertions without masking API failures.
  for (const route of [
    '/login',
    '/dashboard/settings/account',
    '/dashboard/settings',
    '/dashboard/migrations',
    '/dashboard/repositories',
    '/dashboard/inventory',
  ]) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    expect(response.status, `prewarm ${route}`).toBeLessThan(500);
  }
}
