import { z } from 'zod';
import { CompatibilityResultSchema, type CompatibilityResult } from './compatibility.js';

/** Provider-neutral statuses for a local CI/GitHub check projection. */
export const CompatibilityCheckStatusSchema = z.enum(['PASS', 'WARN', 'FAIL', 'NEEDS_REVIEW']);
export type CompatibilityCheckStatus = z.infer<typeof CompatibilityCheckStatusSchema>;

export const CompatibilityCheckFindingSchema = z.strictObject({
  providerId: z.string().min(1),
  changeId: z.string().min(1),
  status: z.enum(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']),
  file: z.string().nullable(),
  line: z.number().int().positive().nullable(),
  symbol: z.string().nullable(),
  reasonCodes: z.array(z.string()).min(1),
  officialSourceUrl: z.string().url(),
  recommendedNextAction: z.enum(['NO_ACTION', 'MANUAL_REVIEW', 'MIGRATION_NOT_AVAILABLE']),
  migrationAvailable: z.boolean(),
  message: z.string().min(1),
});
export type CompatibilityCheckFinding = z.infer<typeof CompatibilityCheckFindingSchema>;

export const CompatibilityCheckSummarySchema = z.strictObject({
  affected: z.number().int().nonnegative(),
  notAffected: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
});

export const CompatibilityCheckResultSchema = z.strictObject({
  checkId: z.string().min(1),
  repositoryId: z.string().min(1),
  baselineSha: z.string().regex(/^[a-f0-9]{64}$/),
  changedFiles: z.array(z.string().min(1)),
  status: CompatibilityCheckStatusSchema,
  summary: CompatibilityCheckSummarySchema,
  findings: z.array(CompatibilityCheckFindingSchema),
  proofsEvaluated: z.number().int().nonnegative(),
  evidenceCoverage: z.enum(['complete', 'partial', 'insufficient']),
  reasonCodes: z.array(z.string()).min(1),
  requiresHumanReview: z.literal(true),
  liveGitHubWritePerformed: z.literal(false),
});
export type CompatibilityCheckResult = z.infer<typeof CompatibilityCheckResultSchema>;

export type CompatibilityCheckInput = {
  checkId: string;
  repositoryId: string;
  baselineSha: string;
  changedFiles: readonly string[];
  proofs: readonly unknown[];
  completeEvidence?: boolean;
};

const compareProofs = (left: CompatibilityResult, right: CompatibilityResult): number =>
  [left.providerId, left.changeId, left.exactFile ?? '', String(left.exactLine ?? 0), left.exactSymbol ?? '']
    .join('\u0000').localeCompare(
      [right.providerId, right.changeId, right.exactFile ?? '', String(right.exactLine ?? 0), right.exactSymbol ?? '']
        .join('\u0000'),
    );

const messageFor = (proof: CompatibilityResult): string => {
  if (proof.status === 'AFFECTED') return `${proof.providerName}: reviewed change affects repository usage`;
  if (proof.status === 'NEEDS_REVIEW') return `${proof.providerName}: compatibility evidence requires human review`;
  return `${proof.providerName}: reviewed change is not applicable to repository usage`;
};

/**
 * Aggregates already-proven compatibility results into a check-shaped result.
 * This function is deliberately local and side-effect free: it does not call
 * GitHub, evaluate unreviewed changes, or infer compatibility from filenames.
 */
export const evaluateCompatibilityCheck = (input: CompatibilityCheckInput): CompatibilityCheckResult => {
  const proofs = input.proofs.map((proof) => CompatibilityResultSchema.parse(proof)).sort(compareProofs);
  const summary = {
    affected: proofs.filter((proof) => proof.status === 'AFFECTED').length,
    notAffected: proofs.filter((proof) => proof.status === 'NOT_AFFECTED').length,
    needsReview: proofs.filter((proof) => proof.status === 'NEEDS_REVIEW').length,
  };

  const findings = proofs.map((proof): CompatibilityCheckFinding => ({
    providerId: proof.providerId,
    changeId: proof.changeId,
    status: proof.status,
    file: proof.exactFile,
    line: proof.exactLine,
    symbol: proof.exactSymbol,
    reasonCodes: [...proof.reasonCodes],
    officialSourceUrl: proof.officialSourceUrl,
    recommendedNextAction: proof.recommendedNextAction,
    migrationAvailable: proof.migrationAvailable,
    message: messageFor(proof),
  }));

  const reasonCodes = new Set<string>();
  let status: CompatibilityCheckStatus;
  if (summary.affected > 0) {
    status = 'FAIL';
    reasonCodes.add('AFFECTED_COMPATIBILITY_PROOF');
  } else if (summary.needsReview > 0) {
    status = 'NEEDS_REVIEW';
    reasonCodes.add('COMPATIBILITY_REQUIRES_REVIEW');
  } else if (proofs.length === 0) {
    status = 'WARN';
    reasonCodes.add('NO_COMPATIBILITY_PROOFS');
  } else if (input.completeEvidence === false) {
    status = 'WARN';
    reasonCodes.add('INCOMPLETE_COMPATIBILITY_EVIDENCE');
  } else {
    status = 'PASS';
    reasonCodes.add('NO_AFFECTED_COMPATIBILITY_PROOF');
  }

  return CompatibilityCheckResultSchema.parse({
    checkId: input.checkId,
    repositoryId: input.repositoryId,
    baselineSha: input.baselineSha,
    changedFiles: [...new Set(input.changedFiles)].sort(),
    status,
    summary,
    findings,
    proofsEvaluated: proofs.length,
    evidenceCoverage: input.completeEvidence === false ? 'partial' : proofs.length === 0 ? 'insufficient' : 'complete',
    reasonCodes: [...reasonCodes],
    requiresHumanReview: true,
    liveGitHubWritePerformed: false,
  });
};
