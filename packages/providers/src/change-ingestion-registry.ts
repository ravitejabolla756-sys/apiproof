import semver from 'semver';
import { CandidateChangeSchema, CandidateReviewSchema, ReviewedCompatibilityChangeSchema, validateApplicabilityScope } from '@apiproof/shared';
import type { CandidateChange, CandidateReview, ReviewedCompatibilityChange } from '@apiproof/shared';
import { DISCOVERY_PROVIDERS } from './discovery-registry.js';

export interface CandidateChangeRegistry {
  readonly candidates: readonly CandidateChange[];
  readonly byCandidateId: ReadonlyMap<string, CandidateChange>;
  readonly bySourceFingerprint: ReadonlyMap<string, readonly CandidateChange[]>;
  readonly byProvider: ReadonlyMap<string, readonly CandidateChange[]>;
  readonly byPackage: ReadonlyMap<string, readonly CandidateChange[]>;
  readonly byOperation: ReadonlyMap<string, readonly CandidateChange[]>;
  /** Multiple official sources may corroborate one eventual production change. */
  readonly byProposedChangeId: ReadonlyMap<string, readonly CandidateChange[]>;
}

const candidateSort = (a: CandidateChange, b: CandidateChange): number => a.candidateId.localeCompare(b.candidateId, 'en');

const validCandidateTransitions: Readonly<Record<CandidateChange['state'], readonly CandidateChange['state'][]>> = {
  discovered: ['normalized', 'rejected'],
  normalized: ['needs_review', 'rejected'],
  needs_review: ['reviewed', 'rejected'],
  reviewed: [],
  rejected: [],
};

function validateCandidateAuditTrail(candidate: CandidateChange): void {
  const trail = candidate.auditTrail;
  const finalState = trail[trail.length - 1]?.state;
  if (finalState !== candidate.state) throw new Error(`CANDIDATE_AUDIT_STATE_MISMATCH:${candidate.candidateId}`);
  if (trail[0]?.state !== 'discovered') throw new Error(`CANDIDATE_AUDIT_INITIAL_STATE_INVALID:${candidate.candidateId}`);
  let previousAt = candidate.discoveredAt;
  for (const [index, entry] of trail.entries()) {
    if (entry.at < previousAt) throw new Error(`CANDIDATE_AUDIT_DATE_INVALID:${candidate.candidateId}`);
    if (index > 0 && !validCandidateTransitions[trail[index - 1]!.state].includes(entry.state)) {
      throw new Error(`CANDIDATE_AUDIT_TRANSITION_INVALID:${candidate.candidateId}`);
    }
    previousAt = entry.at;
  }
}

export function compileCandidateChangeRegistry(inputs: readonly unknown[], providerIds: readonly string[] = DISCOVERY_PROVIDERS.map((provider) => provider.id)): CandidateChangeRegistry {
  const allowedProviders = new Set(providerIds);
  const candidates = inputs.map((input) => CandidateChangeSchema.parse(input)).sort(candidateSort);
  const byCandidateId = new Map<string, CandidateChange>();
  const bySourceFingerprint = new Map<string, CandidateChange[]>();
  const byProvider = new Map<string, CandidateChange[]>();
  const byPackage = new Map<string, CandidateChange[]>();
  const byOperation = new Map<string, CandidateChange[]>();
  const byProposedChangeId = new Map<string, CandidateChange[]>();
  const add = (index: Map<string, CandidateChange[]>, key: string, candidate: CandidateChange): void => {
    const entries = index.get(key) ?? [];
    entries.push(candidate);
    index.set(key, entries);
  };
  for (const candidate of candidates) {
    if (!allowedProviders.has(candidate.providerId)) throw new Error(`CANDIDATE_UNKNOWN_PROVIDER:${candidate.providerId}`);
    validateCandidateAuditTrail(candidate);
    if (byCandidateId.has(candidate.candidateId)) throw new Error(`CANDIDATE_DUPLICATE_ID:${candidate.candidateId}`);
    const sameSource = bySourceFingerprint.get(candidate.sourceFingerprint) ?? [];
    if (sameSource.some((existing) => existing.sourceUrl !== candidate.sourceUrl)) throw new Error(`CANDIDATE_SOURCE_FINGERPRINT_CONFLICT:${candidate.sourceFingerprint}`);
    byCandidateId.set(candidate.candidateId, candidate);
    sameSource.push(candidate);
    bySourceFingerprint.set(candidate.sourceFingerprint, sameSource);
    add(byProvider, candidate.providerId, candidate);
    for (const packageName of candidate.payload.affectedPackages ?? []) add(byPackage, packageName, candidate);
    for (const operation of candidate.payload.apiOperationPatterns ?? []) add(byOperation, operation, candidate);
    add(byProposedChangeId, candidate.payload.changeId ?? candidate.candidateId, candidate);
  }
  return { candidates, byCandidateId, bySourceFingerprint, byProvider, byPackage, byOperation, byProposedChangeId };
}

export function sourceHasUpdated(previous: CandidateChange, incoming: CandidateChange): boolean {
  return previous.candidateId === incoming.candidateId && previous.sourceUrl === incoming.sourceUrl && previous.sourceFingerprint !== incoming.sourceFingerprint;
}

type EvidenceReference = ReviewedCompatibilityChange['evidence'][number];

/** Converts a candidate into a production record only after explicit reviewed promotion. */
export function promoteCandidateToReviewed(candidateInput: unknown, reviewInput: unknown, evidence: readonly EvidenceReference[]): ReviewedCompatibilityChange {
  const candidate = CandidateChangeSchema.parse(candidateInput);
  const review = CandidateReviewSchema.parse(reviewInput) as CandidateReview;
  if (candidate.state !== 'reviewed') throw new Error(`CANDIDATE_NOT_READY_FOR_PROMOTION:${candidate.candidateId}`);
  if (review.reviewerKind !== 'human') throw new Error(`CANDIDATE_HUMAN_REVIEW_REQUIRED:${candidate.candidateId}`);
  if (!candidate.auditTrail.some((entry) => entry.state === 'reviewed')) throw new Error(`CANDIDATE_REVIEW_AUDIT_MISSING:${candidate.candidateId}`);
  if (candidate.sourceFingerprintBasis !== 'full-body') throw new Error(`CANDIDATE_FULL_SOURCE_REQUIRED:${candidate.candidateId}`);
  if (!evidence.some((item) => item.url === candidate.sourceUrl)) throw new Error(`CANDIDATE_SOURCE_NOT_IN_EVIDENCE:${candidate.candidateId}`);
  const payload = candidate.payload;
  if (!payload.changeType || !payload.applicabilityScope || !payload.severity) {
    throw new Error(`CANDIDATE_INCOMPLETE_FOR_PROMOTION:${candidate.candidateId}`);
  }
  const applicability = { ...payload, applicabilityScope: payload.applicabilityScope, affectedPackages: payload.affectedPackages, affectedVersionRange: payload.affectedVersionRange, apiOperationPatterns: payload.apiOperationPatterns ?? [], affectedParameters: payload.affectedParameters ?? [], affectedResponseFields: payload.affectedResponseFields ?? [], affectedEndpoints: payload.affectedEndpoints ?? [], affectedModels: payload.affectedModels ?? [], affectedResources: payload.affectedResources ?? [], apiVersionMetadata: payload.apiVersionMetadata, enumMetadata: payload.enumMetadata };
  validateApplicabilityScope(applicability as never);
  if (payload.affectedVersionRange && !semver.validRange(payload.affectedVersionRange)) throw new Error(`CANDIDATE_INVALID_VERSION_RANGE:${candidate.candidateId}`);
  return ReviewedCompatibilityChangeSchema.parse({
    providerId: candidate.providerId, changeId: payload.changeId ?? candidate.candidateId, title: payload.title,
    description: payload.description, changeType: payload.changeType, publishedAt: payload.publishedAt,
    effectiveAt: payload.effectiveAt, removalAt: payload.removalAt, officialSourceUrl: candidate.sourceUrl,
    sourceType: candidate.sourceType, applicabilityScope: payload.applicabilityScope, affectedPackages: payload.affectedPackages,
    ...(payload.affectedVersionRange ? { affectedVersionRange: payload.affectedVersionRange } : {}), apiOperationPatterns: payload.apiOperationPatterns ?? [],
    affectedParameters: payload.affectedParameters ?? [], affectedResponseFields: payload.affectedResponseFields ?? [],
    affectedEndpoints: payload.affectedEndpoints ?? [], affectedModels: payload.affectedModels ?? [], affectedResources: payload.affectedResources ?? [], authOrHeaderPatterns: payload.authOrHeaderPatterns ?? [],
    enumMetadata: payload.enumMetadata, apiVersionMetadata: payload.apiVersionMetadata, replacement: payload.replacement,
    severity: payload.severity, review: { status: review.status, reviewer: review.reviewer, reviewedAt: review.reviewedAt, provenance: 'official' }, evidence,
  });
}
