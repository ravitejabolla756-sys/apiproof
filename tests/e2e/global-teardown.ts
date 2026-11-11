import fs from 'node:fs';

export default async function globalTeardown() {
  if (process.env.APIPROOF_DB_PATH) return;
  const dbPath = process.env.APIPROOF_E2E_DB_PATH;
  if (!dbPath) return;
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${dbPath}${suffix}`, { force: true }); } catch { /* disposable test cleanup */ }
  }
}
