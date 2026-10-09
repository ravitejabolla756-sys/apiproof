import { NextResponse } from 'next/server';
import { getDatabase, resolveDatabaseConfig } from '../../../../lib/server/db/index.js';
import {
  readPreviewStagingDatabaseConfig,
  verifyPreviewStagingDatabaseIdentity,
} from '../../../../lib/server/db/preview-isolation.js';
import { isAuthorizedInternalRequest } from '../../../../lib/server/internal-auth.js';
import { providerIntelligenceV1Enabled } from '../../../../lib/server/provider-intelligence-feature.js';
import {
  PREVIEW_STAGING_REPOSITORY,
  previewStagingRepositoryPolicyError,
} from '../../../../lib/server/preview-repository-isolation.js';

const noStore = { 'Cache-Control': 'no-store' };

interface ReadinessChecks {
  previewStagingIsolation: boolean;
  providerIntelligence: boolean;
  liveGithub: boolean;
  liveGithubWriteDisabled: boolean;
  genericDatabaseOverrideBlocked: boolean;
  databaseIdentity: boolean;
  repositoryIsolationGuard: boolean;
}

function blockedResponse(checks: ReadinessChecks): NextResponse {
  return NextResponse.json(
    { ok: false, status: 'unverified', scanReadiness: 'BLOCKED', checks },
    { status: 503, headers: noStore },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  const environment = process.env;
  const checks: ReadinessChecks = {
    previewStagingIsolation: environment.APIPROOF_PREVIEW_STAGING_ISOLATION === 'true',
    providerIntelligence: providerIntelligenceV1Enabled(environment),
    liveGithub: environment.APIPROOF_ENABLE_LIVE_GITHUB === 'true',
    liveGithubWriteDisabled: environment.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'false',
    genericDatabaseOverrideBlocked: !environment.DATABASE_URL?.trim(),
    databaseIdentity: false,
    repositoryIsolationGuard: false,
  };

  checks.repositoryIsolationGuard = checks.previewStagingIsolation
    && previewStagingRepositoryPolicyError(PREVIEW_STAGING_REPOSITORY, environment) === null;

  if (checks.previewStagingIsolation && checks.genericDatabaseOverrideBlocked) {
    try {
      const config = readPreviewStagingDatabaseConfig(environment);
      const resolved = resolveDatabaseConfig(environment);
      if (resolved.type === 'postgres' && resolved.url === config.databaseUrl) {
        checks.databaseIdentity = await verifyPreviewStagingDatabaseIdentity(getDatabase(), config);
      }
    } catch {
      checks.databaseIdentity = false;
    }
  }

  const ready = Object.values(checks).every(Boolean);
  if (!ready) return blockedResponse(checks);

  return NextResponse.json(
    { ok: true, status: 'verified', scanReadiness: 'READY', checks },
    { status: 200, headers: noStore },
  );
}
