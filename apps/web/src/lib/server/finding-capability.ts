import { deriveReviewOnlyTemplateProposal, OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from '@apiproof/providers';

export interface FindingCapabilityInput {
  provider: string;
  changeId: string;
  filePath: string;
  lineNumber: number;
  symbol: string;
}

export interface FindingRemediationGuidance {
  mode: 'transform' | 'manual-guidance';
  templateId: string;
  limitation: string;
  summary: string;
  steps: string[];
  validation: string[];
}

export interface FindingCapability {
  source: 'productization';
  baselineSha: string | null;
  scanId: string | null;
  recommendedNextAction: 'NO_ACTION' | 'MANUAL_REVIEW' | 'MIGRATION_AVAILABLE' | 'MIGRATION_NOT_AVAILABLE';
  migrationAvailable: boolean;
  verificationAvailable: boolean;
  evidenceCoverage: 'complete' | 'partial' | 'insufficient' | null;
  reviewStatus: 'draft' | 'reviewed' | 'verified' | null;
  remediation: FindingRemediationGuidance | null;
}

type CompatibilityEvidence = {
  providerId?: unknown;
  changeId?: unknown;
  exactFile?: unknown;
  exactLine?: unknown;
  exactSymbol?: unknown;
  matchedUsages?: unknown;
  recommendedNextAction?: unknown;
  migrationAvailable?: unknown;
  verificationAvailable?: unknown;
  evidenceCoverage?: unknown;
  reviewStatus?: unknown;
};

function isExactFindingMatch(item: CompatibilityEvidence, finding: FindingCapabilityInput): boolean {
  if (item.providerId !== finding.provider || item.changeId !== finding.changeId) return false;
  const exactLocation = item.exactFile === finding.filePath && item.exactLine === finding.lineNumber && item.exactSymbol === finding.symbol;
  if (exactLocation) return true;
  return Array.isArray(item.matchedUsages) && item.matchedUsages.some((usage) => {
    if (!usage || typeof usage !== 'object') return false;
    const value = usage as { location?: { file?: unknown; line?: unknown; symbol?: unknown } };
    return value.location?.file === finding.filePath && value.location?.line === finding.lineNumber && value.location?.symbol === finding.symbol;
  });
}

function capabilityFrom(item: CompatibilityEvidence, projection: Record<string, unknown>): FindingCapability {
  const action = item.recommendedNextAction;
  const evidenceCoverage = item.evidenceCoverage;
  const reviewStatus = item.reviewStatus;
  const remediation = resolveReviewOnlyRemediation(
    typeof item.providerId === 'string' ? item.providerId : '',
    typeof item.changeId === 'string' ? item.changeId : '',
  );
  return {
    source: 'productization',
    baselineSha: typeof projection.baselineSha === 'string' ? projection.baselineSha : null,
    scanId: typeof projection.scanId === 'string' ? projection.scanId : null,
    recommendedNextAction: action === 'NO_ACTION' || action === 'MANUAL_REVIEW' || action === 'MIGRATION_AVAILABLE' || action === 'MIGRATION_NOT_AVAILABLE' ? action : 'MANUAL_REVIEW',
    migrationAvailable: item.migrationAvailable === true,
    verificationAvailable: item.verificationAvailable === true,
    evidenceCoverage: evidenceCoverage === 'complete' || evidenceCoverage === 'partial' || evidenceCoverage === 'insufficient' ? evidenceCoverage : null,
    reviewStatus: reviewStatus === 'draft' || reviewStatus === 'reviewed' || reviewStatus === 'verified' ? reviewStatus : null,
    remediation,
  };
}

/**
 * Resolve only the candidate-specific, review-only playbook for this exact
 * provider/change pair. Never infer migration steps from a provider name or a
 * replacement sentence; absent candidate evidence remains null.
 */
export function resolveReviewOnlyRemediation(providerId: string, changeId: string): FindingRemediationGuidance | null {
  if (!providerId || !changeId) return null;
  const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.find((entry) =>
    entry.providerId === providerId && (entry.candidateId === changeId || entry.payload.changeId === changeId),
  );
  if (!candidate) return null;
  const proposal = deriveReviewOnlyTemplateProposal(candidate);
  if (!proposal) return null;
  if (proposal.mode === 'manual-guidance') {
    return {
      mode: proposal.mode,
      templateId: proposal.templateId,
      limitation: proposal.limitation,
      summary: proposal.guidance.summary,
      steps: [...proposal.guidance.steps],
      validation: [...proposal.guidance.validation],
    };
  }
  return {
    mode: proposal.mode,
    templateId: proposal.templateId,
    limitation: proposal.limitation,
    summary: 'A bounded transformation proposal exists, but it still requires human review and fixture verification before execution.',
    steps: ['Review the proposed transformation against the affected call site.', 'Confirm the change is limited to the documented literal pattern.', 'Request verification only after affected, unaffected, and uncertain fixtures are recorded.'],
    validation: ['Confirm the official source and normalized change digest match.', 'Verify the resulting AST and patch scope before any Draft PR is created.'],
  };
}

/** Resolve capability from the exact persisted scan evidence, never from a broad provider-level guess. */
export function resolveFindingCapability(
  projection: Record<string, unknown> | null,
  finding: FindingCapabilityInput,
): FindingCapability | null {
  if (!projection) return null;
  const results = Array.isArray(projection.compatibilityResults) ? projection.compatibilityResults : [];
  const result = results.find((item): item is CompatibilityEvidence => Boolean(item && typeof item === 'object' && isExactFindingMatch(item as CompatibilityEvidence, finding)));
  return result ? capabilityFrom(result, projection) : null;
}
