export type ProviderCoverage = {
  providerId: string;
  providerName: string;
  sourceUrl: string;
  sourceType: string;
  discoveryAvailable: boolean;
  candidateCount: number;
  reviewedRuleCount: number;
  scannerCoverage: 'reviewed-rules' | 'no-reviewed-rules';
  autoRescan: boolean;
  autoFix: 'guarded-human-review';
  migrationTemplateStatus: 'deterministic-ast' | 'review-only';
  migrationTemplateLimitation: string;
  migrationTemplateCount: number;
  verifiedMigrationTemplateCount: number;
  reviewOnlyTemplateProposalCount: number;
  candidateCountWithoutTemplateProposal: number;
  migrationTemplatePromotion: {
    candidateIds: string[];
    proposalModes: Array<'transform' | 'manual-guidance'>;
    nextStep: string;
  } | null;
  sourceHealth: {
    status: 'never-run' | 'healthy' | 'due' | 'failing' | 'disabled';
    lastSuccessAt: string | null;
    nextAttemptAt: string | null;
    failureCount: number;
    parserStatus: 'structured' | 'review-only' | 'not-run';
  };
};

export type ProviderCoverageResponse = {
  summary: {
    configuredSources: number;
    discoveryProviders: number;
    providersWithReviewedRules: number;
    reviewedRules: number;
    providersWithMigrationTemplates: number;
    migrationTemplates: number;
    providersWithVerifiedMigrationTemplates: number;
    verifiedMigrationTemplates: number;
    providersWithReviewOnlyTemplateProposals: number;
    reviewOnlyTemplateProposals: number;
    autoFixPolicy: 'guarded-human-review';
    reviewQueue: { P0: number; P1: number; P2: number };
    migrationTemplatePromotionQueue: Array<{ providerId: string; candidateIds: string[]; proposalModes: Array<'transform' | 'manual-guidance'>; nextStep: string }>;
  };
  providers: ProviderCoverage[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => text(item));
}

function isPromotion(value: unknown): value is NonNullable<ProviderCoverage['migrationTemplatePromotion']> {
  return record(value)
    && stringList(value.candidateIds)
    && Array.isArray(value.proposalModes)
    && value.proposalModes.every((mode) => mode === 'transform' || mode === 'manual-guidance')
    && text(value.nextStep);
}

function isPromotionQueueItem(value: unknown): value is ProviderCoverageResponse['summary']['migrationTemplatePromotionQueue'][number] {
  return record(value) && text(value.providerId) && isPromotion(value);
}

function isProvider(value: unknown): value is ProviderCoverage {
  if (!record(value) || !text(value.providerId) || !text(value.providerName) || typeof value.sourceUrl !== 'string' || !text(value.sourceType)
    || typeof value.discoveryAvailable !== 'boolean' || !count(value.candidateCount) || !count(value.reviewedRuleCount)
    || (value.scannerCoverage !== 'reviewed-rules' && value.scannerCoverage !== 'no-reviewed-rules')
    || typeof value.autoRescan !== 'boolean' || value.autoFix !== 'guarded-human-review'
    || (value.migrationTemplateStatus !== 'deterministic-ast' && value.migrationTemplateStatus !== 'review-only')
    || !text(value.migrationTemplateLimitation) || !count(value.migrationTemplateCount)
    || !count(value.verifiedMigrationTemplateCount) || !count(value.reviewOnlyTemplateProposalCount)
    || !count(value.candidateCountWithoutTemplateProposal) || (!isPromotion(value.migrationTemplatePromotion) && value.migrationTemplatePromotion !== null)
    || !record(value.sourceHealth)) return false;
  const health = value.sourceHealth;
  return (health.status === 'never-run' || health.status === 'healthy' || health.status === 'due' || health.status === 'failing' || health.status === 'disabled')
    && (health.parserStatus === 'structured' || health.parserStatus === 'review-only' || health.parserStatus === 'not-run')
    && (health.lastSuccessAt === null || typeof health.lastSuccessAt === 'string')
    && (health.nextAttemptAt === null || typeof health.nextAttemptAt === 'string')
    && count(health.failureCount);
}

/** Validate the provider-owned coverage projection before rendering nested metadata. */
export function parseProviderCoverageResponse(value: unknown): ProviderCoverageResponse | null {
  if (!record(value) || !record(value.summary) || !Array.isArray(value.providers)) return null;
  const summary = value.summary;
  const countKeys = ['configuredSources', 'discoveryProviders', 'providersWithReviewedRules', 'reviewedRules', 'providersWithMigrationTemplates', 'migrationTemplates', 'providersWithVerifiedMigrationTemplates', 'verifiedMigrationTemplates', 'providersWithReviewOnlyTemplateProposals', 'reviewOnlyTemplateProposals'] as const;
  if (!countKeys.every((key) => count(summary[key])) || summary.autoFixPolicy !== 'guarded-human-review' || !record(summary.reviewQueue)
    || !count(summary.reviewQueue.P0) || !count(summary.reviewQueue.P1) || !count(summary.reviewQueue.P2)
    || !Array.isArray(summary.migrationTemplatePromotionQueue) || !summary.migrationTemplatePromotionQueue.every(isPromotionQueueItem)
    || !value.providers.every(isProvider)) return null;
  return value as ProviderCoverageResponse;
}
