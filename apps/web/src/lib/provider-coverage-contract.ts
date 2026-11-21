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
  migrationTemplatePromotion: { candidateIds: string[]; proposalModes: Array<'transform' | 'manual-guidance'>; nextStep: string } | null;
  sourceHealth: { status: 'never-run' | 'healthy' | 'due' | 'failing' | 'disabled'; lastSuccessAt: string | null; nextAttemptAt: string | null; failureCount: number; parserStatus: 'structured' | 'review-only' | 'not-run' };
};

export type CoverageResponse = {
  summary: { configuredSources: number; discoveryProviders: number; providersWithReviewedRules: number; reviewedRules: number; providersWithMigrationTemplates: number; migrationTemplates: number; providersWithVerifiedMigrationTemplates: number; verifiedMigrationTemplates: number; providersWithReviewOnlyTemplateProposals: number; reviewOnlyTemplateProposals: number; autoFixPolicy: 'guarded-human-review'; reviewQueue: { P0: number; P1: number; P2: number }; migrationTemplatePromotionQueue: Array<{ providerId: string; candidateIds: string[]; proposalModes: Array<'transform' | 'manual-guidance'>; nextStep: string }> };
  providers: ProviderCoverage[];
};

function record(value: unknown): Record<string, unknown> | undefined { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown, maxLength: number): string | undefined { return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined; }
function nullableText(value: unknown, maxLength: number): string | null | undefined { if (value === null) return null; return text(value, maxLength); }
function count(value: unknown): number | undefined { return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined; }
function enumValue<T extends string>(value: unknown, values: readonly T[]): T | undefined { return typeof value === 'string' && values.includes(value as T) ? value as T : undefined; }

function parsePromotion(value: unknown): ProviderCoverage['migrationTemplatePromotion'] | null | undefined {
  if (value === null) return null;
  const row = record(value); if (!row || !Array.isArray(row.candidateIds) || row.candidateIds.length > 2048 || !Array.isArray(row.proposalModes)) return undefined;
  const candidateIds = row.candidateIds.map((id) => text(id, 256));
  const proposalModes = row.proposalModes.map((mode) => enumValue(mode, ['transform', 'manual-guidance'] as const));
  const nextStep = text(row.nextStep, 1000);
  return nextStep && candidateIds.every(Boolean) && proposalModes.every(Boolean) ? { candidateIds: candidateIds as string[], proposalModes: proposalModes as Array<'transform' | 'manual-guidance'>, nextStep } : undefined;
}

function parseHealth(value: unknown): ProviderCoverage['sourceHealth'] | undefined {
  const row = record(value); if (!row) return undefined;
  const status = enumValue(row.status, ['never-run', 'healthy', 'due', 'failing', 'disabled'] as const);
  const parserStatus = enumValue(row.parserStatus, ['structured', 'review-only', 'not-run'] as const);
  const lastSuccessAt = nullableText(row.lastSuccessAt, 128); const nextAttemptAt = nullableText(row.nextAttemptAt, 128); const failureCount = count(row.failureCount);
  return status && parserStatus && lastSuccessAt !== undefined && nextAttemptAt !== undefined && failureCount !== undefined ? { status, parserStatus, lastSuccessAt, nextAttemptAt, failureCount } : undefined;
}

function parseProvider(value: unknown): ProviderCoverage | undefined {
  const row = record(value); if (!row) return undefined;
  const providerId = text(row.providerId, 256); const providerName = text(row.providerName, 512); const sourceUrl = text(row.sourceUrl, 2048); const sourceType = text(row.sourceType, 128);
  const discoveryAvailable = row.discoveryAvailable; const candidateCount = count(row.candidateCount); const reviewedRuleCount = count(row.reviewedRuleCount); const scannerCoverage = enumValue(row.scannerCoverage, ['reviewed-rules', 'no-reviewed-rules'] as const); const autoRescan = row.autoRescan;
  const autoFix = enumValue(row.autoFix, ['guarded-human-review'] as const); const migrationTemplateStatus = enumValue(row.migrationTemplateStatus, ['deterministic-ast', 'review-only'] as const); const limitation = text(row.migrationTemplateLimitation, 2000); const migrationTemplateCount = count(row.migrationTemplateCount); const verifiedCount = count(row.verifiedMigrationTemplateCount); const reviewOnlyCount = count(row.reviewOnlyTemplateProposalCount); const withoutProposal = count(row.candidateCountWithoutTemplateProposal); const promotion = parsePromotion(row.migrationTemplatePromotion); const sourceHealth = parseHealth(row.sourceHealth);
  if (!providerId || !providerName || !sourceUrl || !/^https:\/\//i.test(sourceUrl) || !sourceType || typeof discoveryAvailable !== 'boolean' || candidateCount === undefined || reviewedRuleCount === undefined || !scannerCoverage || typeof autoRescan !== 'boolean' || !autoFix || !migrationTemplateStatus || !limitation || migrationTemplateCount === undefined || verifiedCount === undefined || reviewOnlyCount === undefined || withoutProposal === undefined || promotion === undefined || !sourceHealth) return undefined;
  return { providerId, providerName, sourceUrl, sourceType, discoveryAvailable, candidateCount, reviewedRuleCount, scannerCoverage, autoRescan, autoFix, migrationTemplateStatus, migrationTemplateLimitation: limitation, migrationTemplateCount, verifiedMigrationTemplateCount: verifiedCount, reviewOnlyTemplateProposalCount: reviewOnlyCount, candidateCountWithoutTemplateProposal: withoutProposal, migrationTemplatePromotion: promotion, sourceHealth };
}

export function parseProviderCoverageResponse(value: unknown): CoverageResponse | undefined {
  const payload = record(value); const summary = record(payload?.summary);
  if (!payload || !summary || !Array.isArray(payload.providers) || payload.providers.length > 1024 || !Array.isArray(summary.migrationTemplatePromotionQueue)) return undefined;
  const countKeys = ['configuredSources', 'discoveryProviders', 'providersWithReviewedRules', 'reviewedRules', 'providersWithMigrationTemplates', 'migrationTemplates', 'providersWithVerifiedMigrationTemplates', 'verifiedMigrationTemplates', 'providersWithReviewOnlyTemplateProposals', 'reviewOnlyTemplateProposals'] as const;
  const summaryCounts = Object.fromEntries(countKeys.map((key) => [key, count(summary[key])]));
  const queue = summary.migrationTemplatePromotionQueue.map((item) => { const row = record(item); if (!row || !Array.isArray(row.candidateIds) || !Array.isArray(row.proposalModes)) return undefined; const providerId = text(row.providerId, 256); const candidateIds = row.candidateIds.map((id) => text(id, 256)); const proposalModes = row.proposalModes.map((mode) => enumValue(mode, ['transform', 'manual-guidance'] as const)); const nextStep = text(row.nextStep, 1000); return providerId && nextStep && candidateIds.every(Boolean) && proposalModes.every(Boolean) ? { providerId, candidateIds: candidateIds as string[], proposalModes: proposalModes as Array<'transform' | 'manual-guidance'>, nextStep } : undefined; });
  const providers = payload.providers.map(parseProvider); const reviewQueue = record(summary.reviewQueue); const p0 = reviewQueue ? count(reviewQueue.P0) : undefined; const p1 = reviewQueue ? count(reviewQueue.P1) : undefined; const p2 = reviewQueue ? count(reviewQueue.P2) : undefined;
  if (!countKeys.every((key) => summaryCounts[key] !== undefined) || summary.autoFixPolicy !== 'guarded-human-review' || p0 === undefined || p1 === undefined || p2 === undefined || !queue.every(Boolean) || !providers.every(Boolean)) return undefined;
  const numericSummary = summaryCounts as unknown as Pick<CoverageResponse['summary'], typeof countKeys[number]>;
  return { summary: { ...numericSummary, autoFixPolicy: 'guarded-human-review', reviewQueue: { P0: p0, P1: p1, P2: p2 }, migrationTemplatePromotionQueue: queue as CoverageResponse['summary']['migrationTemplatePromotionQueue'] }, providers: providers as ProviderCoverage[] };
}
