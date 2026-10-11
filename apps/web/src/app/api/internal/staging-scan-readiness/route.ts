import { NextResponse } from 'next/server';
import { getDatabase, resolveDatabaseConfig } from '../../../../lib/server/db/index.js';
import {
  readPreviewStagingDatabaseConfig,
  classifyPreviewStagingDatabaseError,
  verifyPreviewStagingDatabaseIdentityDetailed,
} from '../../../../lib/server/db/preview-isolation.js';
import { isAuthorizedInternalRequest } from '../../../../lib/server/internal-auth.js';
import { providerIntelligenceV1Enabled } from '../../../../lib/server/provider-intelligence-feature.js';
import { logger } from '../../../../lib/server/logger.js';
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
    let failureStage: 'configuration' | 'adapter-construction' = 'configuration';
    try {
      const config = readPreviewStagingDatabaseConfig(environment);
      const resolved = resolveDatabaseConfig(environment);
      if (resolved.type !== 'postgres' || resolved.url !== config.databaseUrl) {
        logger.error('MYOWL_STAGING_DB_DIAGNOSTIC', {
          category: 'DB_CONFIG_INVALID',
          stage: failureStage,
        });
      } else {
        failureStage = 'adapter-construction';
        const db = getDatabase();
        const identity = await verifyPreviewStagingDatabaseIdentityDetailed(db, config);
        checks.databaseIdentity = identity.verified;
        if (!identity.verified) {
          logger.error('MYOWL_STAGING_DB_DIAGNOSTIC', {
            category: identity.failureCategory ?? 'DB_FAILURE_UNCLASSIFIED',
            stage: identity.failureStage ?? 'identity-query',
          });
        }
      }
    } catch (error) {
      checks.databaseIdentity = false;
      logger.error('MYOWL_STAGING_DB_DIAGNOSTIC', {
        category: classifyPreviewStagingDatabaseError(error, failureStage),
        stage: failureStage,
      });
    }
  }

  const ready = Object.values(checks).every(Boolean);
  if (!ready) return blockedResponse(checks);

  return NextResponse.json(
    { ok: true, status: 'verified', scanReadiness: 'READY', checks },
    { status: 200, headers: noStore },
  );
}
