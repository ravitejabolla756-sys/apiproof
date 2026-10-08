import { closeDatabase, runMigrations } from '../src/lib/server/db/index.js';
import { PostgresDatabaseAdapter } from '../src/lib/server/db/postgres-adapter.js';
import {
  bootstrapStagingDatabase,
  readStagingBootstrapConfig,
  verifyStagingDatabaseIdentity,
} from '../src/lib/server/db/staging-bootstrap.js';

async function main(): Promise<void> {
  const config = readStagingBootstrapConfig();
  const db = new PostgresDatabaseAdapter(config.databaseUrl);
  try {
    await verifyStagingDatabaseIdentity(db, config);
    const applied = await runMigrations(db);
    const result = await bootstrapStagingDatabase(db, config);

    console.log(JSON.stringify({
      status: 'ok',
      migrationsApplied: applied.length,
      created: result.created,
      repository: result.repository.fullName,
      githubRepositoryId: result.repository.githubRepositoryId,
      counts: result.counts,
    }));
  } finally {
    await db.close();
    await closeDatabase();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'STAGING_BOOTSTRAP_FAILED';
  console.error(message.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@'));
  process.exit(1);
});
