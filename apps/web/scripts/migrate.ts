import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, runMigrations, closeDatabase } from '../src/lib/server/db/index.js';

function loadLocalEnv(): void {
  if (typeof process.loadEnvFile !== 'function') return;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), '../..', '.env'),
    path.resolve(__dirname, '../../..', '.env'),
    path.resolve(__dirname, '../..', '.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
      } catch {
        // ignore
      }
    }
  }
}

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  return msg.replace(/postgres(?:ql)?:\/\/[^@]+@/gi, 'postgresql://[REDACTED]@');
}

async function main() {
  loadLocalEnv();

  console.log('--- APIProof Database Migrations ---');
  const db = getDatabase();
  console.log(`Database engine active: ${db.engine}`);
  if (db.engine === 'postgres') {
    console.log('Target: Remote PostgreSQL (credentials redacted)');
  } else {
    console.log('Target: Local SQLite development database');
  }

  const applied = await runMigrations(db);

  if (applied.length === 0) {
    console.log('Database is up to date. No pending migrations.');
  } else {
    console.log(`Successfully applied ${applied.length} migration(s):`);
    for (const m of applied) {
      console.log(`  - [${m.id}] ${m.name} (at ${m.appliedAt})`);
    }
  }

  await closeDatabase();
  console.log('Migration process completed successfully.');
}

main().catch(async (error) => {
  console.error('Migration failed with error:', sanitizeError(error));
  try {
    await closeDatabase();
  } catch {
    // ignore
  }
  process.exit(1);
});
