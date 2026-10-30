import type { CandidateChangeRegistry } from './change-ingestion-registry.js';
import type { ProductionChangeRegistry } from './compatibility-registry.js';
import type { ProviderDefinition } from './discovery-registry.js';
import { buildMigrationTemplateCoverageIndex, MIGRATION_TEMPLATE_COVERAGE } from './migration-template-coverage.js';
import type { MigrationTemplateCoverage } from './migration-template-coverage.js';
import { deriveReviewOnlyTemplateProposal } from './provider-template-proposals.js';

export interface ProviderChangeSourceSummary {
  readonly providerId: string;
  readonly displayName: string;
  readonly sourceUrl: string;
  readonly sourceType: string;
}

export interface ProviderCapabilityMatrixRow {
  readonly providerId: string;
  readonly providerName: string;
  readonly sourceUrl: string;
  readonly sourceType: string;
  readonly sourceMonitoring: 'scheduled-source-monitor';
  readonly discoveryAvailable: boolean;
  readonly candidateCount: number;
  readonly reviewedRuleCount: number;
  readonly scannerCoverage: 'reviewed-rules' | 'no-reviewed-rules';
  readonly autoRescan: boolean;
  readonly autoFix: 'guarded-human-review';
  readonly migrationTemplateStatus: MigrationTemplateCoverage['status'];
  /** Human-readable boundary for what the provider template can and cannot change. */
  readonly migrationTemplateLimitation: string;
  /** Templates declared for the provider review catalog, not proof of execution. */
  readonly migrationTemplateCount: number;
  readonly migrationTemplateIds: readonly string[];
  /** Templates backed by a verified executable transformation registry entry. */
  readonly verifiedMigrationTemplateCount: number;
  readonly verifiedMigrationTemplateIds: readonly string[];
  /** Candidate-derived proposals that still require human review and promotion. */
  readonly reviewOnlyTemplateProposalCount: number;
  readonly candidateCountWithoutTemplateProposal: number;
  /** Exact candidate queue for providers whose declared templates are not yet verified. */
  readonly migrationTemplatePromotion: {
    readonly candidateIds: readonly string[];
    readonly proposalModes: readonly ('transform' | 'manual-guidance')[];
    readonly nextStep: string;
  } | null;
}

export interface ProviderIntelligenceCoverage {
  providerId: string;
  providerName: string;
  discovery: boolean;
  versionAware: boolean;
  candidateChangeCount: number;
  reviewedChangeCount: number;
  migrationCount: number;
  verifiedMigrationCount: number;
}

export interface ProviderCapabilitySummary {
  readonly configuredSources: number;
  readonly discoveryProviders: number;
  readonly providersWithReviewedRules: number;
  readonly reviewedRules: number;
  readonly providersWithMigrationTemplates: number;
  readonly migrationTemplates: number;
  readonly providersWithVerifiedMigrationTemplates: number;
  readonly verifiedMigrationTemplates: number;
  readonly providersWithReviewOnlyTemplateProposals: number;
  readonly reviewOnlyTemplateProposals: number;
  readonly autoFixPolicy: 'guarded-human-review';
}

/** Deterministic local coverage report; it never infers reviewed or migration capability. */
export function buildProviderIntelligenceCoverage(
  providers: readonly ProviderDefinition[],
  candidates: CandidateChangeRegistry,
  reviewed: ProductionChangeRegistry,
): ProviderIntelligenceCoverage[] {
  return providers.map((provider) => ({
    providerId: provider.id,
    providerName: provider.displayName,
    discovery: provider.capabilities.includes('discovery'),
    versionAware: provider.capabilities.includes('versionAware'),
    candidateChangeCount: candidates.byProvider.get(provider.id)?.length ?? 0,
    reviewedChangeCount: reviewed.byProvider.get(provider.id)?.length ?? 0,
    migrationCount: provider.capabilities.includes('migration') ? 1 : 0,
    verifiedMigrationCount: provider.capabilities.includes('verifiedMigration') ? 1 : 0,
  })).sort((a, b) => a.providerId.localeCompare(b.providerId, 'en'));
}

/**
 * Joins the explicit changelog catalog to reviewed registry state. It does
 * not turn discovery, a candidate, or a source URL into scanner support.
 */
export function buildProviderCapabilityMatrix(
  sources: readonly ProviderChangeSourceSummary[],
  providers: readonly ProviderDefinition[],
  candidates: CandidateChangeRegistry,
  reviewed: ProductionChangeRegistry,
  templateCoverage: readonly MigrationTemplateCoverage[] = MIGRATION_TEMPLATE_COVERAGE,
  verifiedTemplateIds: ReadonlySet<string> = new Set(),
): ProviderCapabilityMatrixRow[] {
  const discoveryById = new Map(providers.map((provider) => [provider.id, provider]));
  const templateByProvider = buildMigrationTemplateCoverageIndex(templateCoverage);
  return sources.map((source) => {
    const discovery = discoveryById.get(source.providerId);
    const providerCandidates = candidates.byProvider.get(source.providerId) ?? [];
    const candidateCount = providerCandidates.length;
    const reviewOnlyTemplateProposalCount = providerCandidates.filter((candidate) => deriveReviewOnlyTemplateProposal(candidate) !== undefined).length;
    const reviewedRuleCount = reviewed.byProvider.get(source.providerId)?.length ?? 0;
    const templates = templateByProvider.get(source.providerId) ?? {
      providerId: source.providerId,
      status: 'review-only' as const,
      templateIds: [],
      supportedLanguages: [],
      requiresHumanReview: true as const,
      limitation: 'Provider is not present in the launch migration-template catalog.',
    };
    const verifiedMigrationTemplateIds = templates.templateIds.filter((templateId) => verifiedTemplateIds.has(templateId));
    const promotionCandidates = verifiedMigrationTemplateIds.length === 0 ? providerCandidates : [];
    const proposalModes = [...new Set(promotionCandidates
      .map((candidate) => deriveReviewOnlyTemplateProposal(candidate)?.mode)
      .filter((mode): mode is 'transform' | 'manual-guidance' => mode !== undefined))].sort() as Array<'transform' | 'manual-guidance'>;
    return {
      providerId: source.providerId,
      providerName: source.displayName,
      sourceUrl: source.sourceUrl,
      sourceType: source.sourceType,
      sourceMonitoring: 'scheduled-source-monitor',
      discoveryAvailable: Boolean(discovery?.capabilities.includes('discovery')),
      candidateCount,
      reviewedRuleCount,
      scannerCoverage: reviewedRuleCount > 0 ? 'reviewed-rules' : 'no-reviewed-rules',
      autoRescan: reviewedRuleCount > 0,
      autoFix: 'guarded-human-review',
      migrationTemplateStatus: templates.status,
      migrationTemplateLimitation: templates.limitation,
      migrationTemplateCount: templates.templateIds.length,
      migrationTemplateIds: templates.templateIds,
      verifiedMigrationTemplateCount: verifiedMigrationTemplateIds.length,
      verifiedMigrationTemplateIds: verifiedMigrationTemplateIds,
      reviewOnlyTemplateProposalCount,
      candidateCountWithoutTemplateProposal: candidateCount - reviewOnlyTemplateProposalCount,
      migrationTemplatePromotion: promotionCandidates.length > 0 ? {
        candidateIds: promotionCandidates.map((candidate) => candidate.candidateId).sort(),
        proposalModes,
        nextStep: proposalModes.includes('transform')
          ? 'Review bounded transforms with affected, unaffected, and uncertain fixtures, then bind a human-reviewed digest.'
          : 'Complete the manual migration review; promote only if behavior-preserving AST equivalence is proven.',
      } : null,
    } satisfies ProviderCapabilityMatrixRow;
  }).sort((a, b) => a.providerId.localeCompare(b.providerId, 'en'));
}

/** Derives public counts from the capability matrix so registry and UI claims cannot drift. */
export function buildProviderCapabilitySummary(rows: readonly ProviderCapabilityMatrixRow[]): ProviderCapabilitySummary {
  return {
    configuredSources: rows.length,
    discoveryProviders: rows.filter((row) => row.discoveryAvailable).length,
    providersWithReviewedRules: rows.filter((row) => row.reviewedRuleCount > 0).length,
    reviewedRules: rows.reduce((total, row) => total + row.reviewedRuleCount, 0),
    providersWithMigrationTemplates: rows.filter((row) => row.migrationTemplateCount > 0).length,
    migrationTemplates: rows.reduce((total, row) => total + row.migrationTemplateCount, 0),
    providersWithVerifiedMigrationTemplates: rows.filter((row) => row.verifiedMigrationTemplateCount > 0).length,
    verifiedMigrationTemplates: rows.reduce((total, row) => total + row.verifiedMigrationTemplateCount, 0),
    providersWithReviewOnlyTemplateProposals: rows.filter((row) => row.reviewOnlyTemplateProposalCount > 0).length,
    reviewOnlyTemplateProposals: rows.reduce((total, row) => total + row.reviewOnlyTemplateProposalCount, 0),
    autoFixPolicy: 'guarded-human-review',
  };
}
