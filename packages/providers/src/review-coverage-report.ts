import type { CandidateChange, ReviewedCompatibilityChange } from '@apiproof/shared';

export type ProviderReviewCoverageRow = {
  providerId: string;
  candidateId: string;
  title: string;
  state: CandidateChange['state'];
  sourceUrl: string;
  sourceType: string;
  sourceFingerprint: string;
  evidenceClaims: number;
  scopeDimensions: string[];
  reviewedInProduction: boolean;
  hasExecutableTemplate: boolean;
  templateLimitation: string;
  priority: 'P0' | 'P1' | 'P2';
  reviewBlockers: string[];
  nextAction: 'human-review' | 'fixture-and-review' | 'already-reviewed';
};

export type ProviderReviewCoverageReport = {
  generatedAt: string;
  expectedProviderCount: number;
  monitoredProviderIds: string[];
  reviewedProviderIds: string[];
  rows: ProviderReviewCoverageRow[];
  summary: {
    candidates: number;
    pendingCandidates: number;
    reviewedCandidates: number;
    reviewedProviders: number;
    providersMissingReviewedRules: string[];
    providersWithExecutableTemplates: string[];
  };
};

type TemplateCoverageEntry = { providerId: string; status: string; templateIds?: readonly string[]; limitation?: string };

function detectorTokenCount(candidate: CandidateChange): number {
  const payload = candidate.payload as Record<string, unknown>;
  const fields = ['apiOperationPatterns', 'affectedModels', 'affectedEndpoints', 'affectedParameters', 'affectedResponseFields', 'affectedDomains', 'affectedResources', 'authOrHeaderPatterns'] as const;
  const tokens = fields.flatMap((field) => {
    const value = payload[field];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  });
  const versions = payload.apiVersionMetadata;
  if (versions && typeof versions === 'object' && !Array.isArray(versions)) {
    for (const key of ['version', 'replacement'] as const) {
      const value = (versions as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) tokens.push(value);
    }
  }
  return new Set(tokens).size;
}

function reviewPriority(input: { reviewed: boolean; evidenceClaims: number; detectorTokens: number; hasExecutableTemplate: boolean }): 'P0' | 'P1' | 'P2' {
  if (input.reviewed) return 'P2';
  if (input.evidenceClaims > 0 && input.detectorTokens > 0 && input.hasExecutableTemplate) return 'P0';
  if (input.evidenceClaims > 0 && input.detectorTokens > 0) return 'P1';
  return 'P2';
}

/** Reporting only: it never changes candidate state or promotes a rule. */
export function buildProviderReviewCoverageReport(input: {
  candidates: readonly CandidateChange[];
  monitoredProviderIds: readonly string[];
  reviewedChanges: readonly Pick<ReviewedCompatibilityChange, 'providerId' | 'changeId'>[];
  templateCoverage: readonly TemplateCoverageEntry[];
  expectedProviderCount?: number;
  generatedAt?: string;
}): ProviderReviewCoverageReport {
  const reviewedKeys = new Set(input.reviewedChanges.map((change) => `${change.providerId}:${change.changeId}`));
  const templateByProvider = new Map(input.templateCoverage.map((entry) => [entry.providerId, entry]));
  const templateProviders = new Set(input.templateCoverage.filter((entry) => entry.status === 'deterministic-ast').map((entry) => entry.providerId));
  const rows = [...input.candidates].sort((a, b) => `${a.providerId}:${a.candidateId}`.localeCompare(`${b.providerId}:${b.candidateId}`, 'en')).map((candidate) => {
    const changeId = candidate.payload.changeId ?? candidate.candidateId;
    const reviewedInProduction = reviewedKeys.has(`${candidate.providerId}:${changeId}`);
    const evidenceClaims = candidate.sourceEvidence?.claims.length ?? 0;
    const detectorTokens = detectorTokenCount(candidate);
    // Provider-level coverage is not enough: a provider may have one narrow
    // literal transformation while another candidate for the same provider
    // requires a semantic migration. Report executability only when the exact
    // reviewed change is bound to a deterministic template ID.
    const templateEntry = templateByProvider.get(candidate.providerId);
    const hasExecutableTemplate = templateEntry?.status === 'deterministic-ast'
      && (templateEntry.templateIds?.includes(changeId) ?? false);
    const templateLimitation = templateEntry?.limitation ?? 'No migration-template coverage is registered; remediation remains review-only.';
    const reviewBlockers: string[] = [];
    if (!reviewedInProduction) reviewBlockers.push('Human approval with affected, unaffected, and uncertain fixtures is required.');
    if (evidenceClaims === 0) reviewBlockers.push('Source evidence claims are missing.');
    if (detectorTokens === 0) reviewBlockers.push('No bounded detector token is available.');
    if (!hasExecutableTemplate) reviewBlockers.push('No executable migration template; remediation remains review-only.');
    return {
      providerId: candidate.providerId,
      candidateId: candidate.candidateId,
      title: candidate.payload.title,
      state: candidate.state,
      sourceUrl: candidate.sourceUrl,
      sourceType: candidate.sourceType,
      sourceFingerprint: candidate.sourceFingerprint,
      evidenceClaims,
      scopeDimensions: [...(candidate.payload.applicabilityScope?.dimensions ?? [])],
      reviewedInProduction,
      hasExecutableTemplate,
      templateLimitation,
      priority: reviewPriority({ reviewed: reviewedInProduction, evidenceClaims, detectorTokens, hasExecutableTemplate }),
      reviewBlockers,
      // Source claims and scope are prerequisites, not fixture evidence.
      // Approval requires three submitted outcomes validated server-side. Do
      // not send an under-specified candidate straight to fixture review: a
      // reviewer first needs source-backed claims and at least one bounded
      // detector token to know what the fixtures are proving.
      nextAction: reviewedInProduction
        ? 'already-reviewed'
        : evidenceClaims > 0 && detectorTokens > 0
          ? 'fixture-and-review'
          : 'human-review',
    } satisfies ProviderReviewCoverageRow;
  });
  const reviewedProviderIds = [...new Set(rows.filter((row) => row.reviewedInProduction).map((row) => row.providerId))].sort();
  const monitoredProviderIds = [...new Set(input.monitoredProviderIds)].sort();
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    expectedProviderCount: input.expectedProviderCount ?? monitoredProviderIds.length,
    monitoredProviderIds,
    reviewedProviderIds,
    rows,
    summary: {
      candidates: rows.length,
      pendingCandidates: rows.filter((row) => !row.reviewedInProduction).length,
      reviewedCandidates: rows.filter((row) => row.reviewedInProduction).length,
      reviewedProviders: reviewedProviderIds.length,
      providersMissingReviewedRules: monitoredProviderIds.filter((providerId) => !reviewedProviderIds.includes(providerId)),
      providersWithExecutableTemplates: [...templateProviders].filter((providerId) => monitoredProviderIds.includes(providerId)).sort(),
    },
  };
}
