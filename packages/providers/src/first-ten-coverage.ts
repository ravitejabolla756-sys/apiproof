import type { ReviewedCompatibilityChange } from '@apiproof/shared';
import type { ProductionChangeRegistry } from './compatibility-registry.js';

export interface ReviewedRuleCoverage {
  providerId: string;
  changeId: string;
  changeType: ReviewedCompatibilityChange['changeType'];
  applicabilityDimensions: readonly string[];
  severity: ReviewedCompatibilityChange['severity'];
  officialSourceUrl: string;
  reviewStatus: ReviewedCompatibilityChange['review']['status'];
  migrationAvailability: 'none';
  verificationAvailability: 'compatibility-proof';
}

/** Machine-readable milestone report. It describes facts in the registry and never infers migrations. */
export function buildReviewedRuleCoverage(registry: ProductionChangeRegistry): ReviewedRuleCoverage[] {
  return registry.changes.map((change) => ({
    providerId: change.providerId,
    changeId: change.changeId,
    changeType: change.changeType,
    applicabilityDimensions: change.applicabilityScope.dimensions,
    severity: change.severity,
    officialSourceUrl: change.officialSourceUrl,
    reviewStatus: change.review.status,
    migrationAvailability: 'none',
    verificationAvailability: 'compatibility-proof',
  }));
}
