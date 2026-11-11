import { expect } from '@playwright/test';

export default async function globalSetup() {
  const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100');
  const baseUrl = `http://127.0.0.1:${port}`;
  for (const route of ['/login', '/dashboard/settings/account', '/dashboard/settings']) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    expect(response.status, `prewarm ${route}`).toBeLessThan(500);
  }
}
