import { NextResponse } from 'next/server';
import {
  buildProviderCapabilityMatrix,
  buildProviderCapabilitySummary,
  buildProviderReviewCoverageReport,
  DISCOVERY_PROVIDERS,
  LOCAL_REVIEWED_PRODUCTION_RECORDS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
} from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '@/lib/server/provider-change-monitor';
import { getProviderSourceHealth } from '@/lib/server/provider-source-health';
import { getCurrentUser } from '@/lib/server/auth';
import { loadVerifiedMigrationTemplateIds } from '@/lib/server/migration-template-verification';
import path from 'node:path';

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' };

/**
 * Exposes the provider capability boundary without inferring support from
 * discovery metadata. A provider is scanner-covered only when at least one
 * reviewed compatibility rule exists for that provider.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore });

  const verifiedTemplateIds = loadVerifiedMigrationTemplateIds(path.resolve(process.cwd()));
  const rows = buildProviderCapabilityMatrix(PROVIDER_CHANGE_SOURCES, DISCOVERY_PROVIDERS, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY, undefined, verifiedTemplateIds);
  const capabilitySummary = buildProviderCapabilitySummary(rows);
  const reviewCoverage = buildProviderReviewCoverageReport({
    candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
    monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
    reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
    templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
    expectedProviderCount: 19,
  });
  const sourceHealth = await getProviderSourceHealth();
  const healthByProvider = new Map(sourceHealth.map((health) => [health.providerId, health]));
  const providers = rows.map((row) => ({ ...row, sourceHealth: healthByProvider.get(row.providerId) }));

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      ...capabilitySummary,
      reviewQueue: {
        P0: reviewCoverage.rows.filter((row) => row.priority === 'P0' && !row.reviewedInProduction).length,
        P1: reviewCoverage.rows.filter((row) => row.priority === 'P1' && !row.reviewedInProduction).length,
        P2: reviewCoverage.rows.filter((row) => row.priority === 'P2' && !row.reviewedInProduction).length,
      },
      sourceHealth: {
        healthy: sourceHealth.filter((source) => source.status === 'healthy').length,
        due: sourceHealth.filter((source) => source.status === 'due').length,
        failing: sourceHealth.filter((source) => source.status === 'failing').length,
        neverRun: sourceHealth.filter((source) => source.status === 'never-run').length,
      },
      parser: {
        structured: sourceHealth.filter((source) => source.parserStatus === 'structured').length,
        reviewOnly: sourceHealth.filter((source) => source.parserStatus === 'review-only').length,
        notRun: sourceHealth.filter((source) => source.parserStatus === 'not-run').length,
      },
      migrationTemplatePromotionQueue: providers
        .filter((provider) => provider.migrationTemplatePromotion !== null)
        .map((provider) => ({ providerId: provider.providerId, ...provider.migrationTemplatePromotion! })),
    },
    providers,
  }, { headers: privateNoStore });
}
