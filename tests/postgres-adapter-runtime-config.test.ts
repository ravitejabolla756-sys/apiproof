import { afterEach, describe, expect, it } from 'vitest';
import { buildRuntimePostgresPoolConfig } from '../apps/web/src/lib/server/db/postgres-adapter.js';

describe('PostgresDatabaseAdapter runtime pool configuration', () => {
  const originalCaCert = process.env.APIPROOF_PG_CA_CERT;

  afterEach(() => {
    if (originalCaCert === undefined) {
      delete process.env.APIPROOF_PG_CA_CERT;
    } else {
      process.env.APIPROOF_PG_CA_CERT = originalCaCert;
    }
  });

  it('forwards the runtime CA certificate to the pool config while keeping TLS verification enabled', () => {
    process.env.APIPROOF_PG_CA_CERT = 'trusted-ca-for-test-only';

    const config = buildRuntimePostgresPoolConfig(
      'postgresql://postgres.projectref:secret@aws-0-region.pooler.supabase.com:6543/postgres',
    );

    expect(config.ssl).toEqual({
      ca: 'trusted-ca-for-test-only',
      rejectUnauthorized: true,
    });
  });
});
