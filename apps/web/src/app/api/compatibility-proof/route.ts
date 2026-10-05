import { NextResponse } from 'next/server';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { getCurrentUser } from '../../../lib/server/auth.js';

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' };

/**
 * Production-safe Compatibility Proof boundary.
 *
 * Repository-bound proof execution remains owned by the scan/evaluator layer.
 * This endpoint exposes only reviewed production registry state and never
 * manufactures proofs when no reviewed records are available.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore });

  const changes = PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => ({
    providerId: change.providerId, changeId: change.changeId, title: change.title,
    changeType: change.changeType, officialSourceUrl: change.officialSourceUrl,
    publishedAt: change.publishedAt ?? null, effectiveAt: change.effectiveAt ?? null, removalAt: change.removalAt ?? null,
    severity: change.severity, reviewStatus: change.review.status, provenance: change.review.provenance,
    applicabilityScope: change.applicabilityScope, affectedModels: change.affectedModels ?? [], affectedResources: change.affectedResources ?? [],
    affectedResponseFields: change.affectedResponseFields ?? [],
    replacement: change.replacement ?? null,
    reviewer: change.review.reviewer, reviewedAt: change.review.reviewedAt,
    documentFingerprint: change.review.documentFingerprint ?? null,
    evidenceFingerprint: change.review.evidenceFingerprint ?? null,
    candidateFingerprint: change.review.candidateFingerprint ?? null,
  }));
  return NextResponse.json({
    ok: true, claimsAvailable: changes.length > 0, proofs: [], changes,
    reason: changes.length > 0 ? null : 'NO_REVIEWED_PRODUCTION_CHANGES',
  }, { headers: privateNoStore });
}
