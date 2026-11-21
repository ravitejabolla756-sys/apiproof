import { expect } from '@playwright/test';
import { closeDatabase, getDatabase, initDatabase } from '../../apps/web/src/lib/server/db/index.js';

export default async function globalSetup() {
  const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100');
  const baseUrl = `http://127.0.0.1:${port}`;
  const databasePath = process.env.APIPROOF_E2E_DB_PATH;
  if (!databasePath) throw new Error('APIPROOF_E2E_DB_PATH is required for the disposable Playwright fixture.');

  initDatabase(databasePath);
  try {
    const database = getDatabase();
    await database.execute('UPDATE users SET email_verified_at = ? WHERE email = ?', [new Date().toISOString(), 'developer@apiproof.dev']);
  } finally {
    await closeDatabase();
  }

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
