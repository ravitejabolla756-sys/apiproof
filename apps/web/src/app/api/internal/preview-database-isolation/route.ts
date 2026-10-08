import { NextResponse } from 'next/server';
import { getDatabase, resolveDatabaseConfig } from '../../../../lib/server/db/index.js';
import {
  readPreviewStagingDatabaseConfig,
  verifyPreviewStagingDatabaseIdentity,
} from '../../../../lib/server/db/preview-isolation.js';
import { isAuthorizedInternalRequest } from '../../../../lib/server/internal-auth.js';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * Read-only staging database verification for authenticated operators.
 * It intentionally exposes only verified/unverified status.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  try {
    const config = readPreviewStagingDatabaseConfig();
    const resolved = resolveDatabaseConfig();
    if (resolved.type !== 'postgres' || resolved.url !== config.databaseUrl) {
      return NextResponse.json({ ok: false, status: 'unverified' }, { status: 503, headers: noStore });
    }

    const verified = await verifyPreviewStagingDatabaseIdentity(getDatabase(), config);
    return NextResponse.json(
      { ok: verified, status: verified ? 'verified' : 'unverified' },
      { status: verified ? 200 : 503, headers: noStore },
    );
  } catch {
    return NextResponse.json({ ok: false, status: 'unverified' }, { status: 503, headers: noStore });
  }
}
