import { z } from 'zod';
import { CandidateChangeSchema } from './change-ingestion.js';
import { CompatibilityResultSchema, CompatibilityStatusSchema } from './compatibility.js';

export const CandidateCompatibilityPreviewSchema = z.strictObject({
  previewKind: z.literal('candidate-unreviewed'),
  candidateId: z.string().min(1), providerId: z.string().min(1), changeId: z.string().min(1), changeTitle: z.string().min(1),
  officialSourceUrl: z.url(), packageName: z.string().nullable(), declaredVersion: z.string().nullable(), resolvedVersion: z.string().nullable(),
  status: CompatibilityStatusSchema, exactFile: z.string().nullable(), exactLine: z.number().int().positive().nullable(), exactSymbol: z.string().nullable(),
  reasonCodes: z.array(z.string()).min(1), evidenceCoverage: z.enum(['complete', 'partial', 'insufficient']), unknowns: z.array(z.string()).min(1),
  nextAction: z.literal('MANUAL_REVIEW'), reviewStatus: z.literal('needs_review'),
});
export type CandidateCompatibilityPreview = z.infer<typeof CandidateCompatibilityPreviewSchema>;

/** Explicitly labels local candidate output so it cannot be mistaken for production proof. */
export function buildCandidateCompatibilityPreview(candidateInput: unknown, resultInput: unknown, unknowns: readonly string[]): CandidateCompatibilityPreview {
  const candidate = CandidateChangeSchema.parse(candidateInput);
  const result = CompatibilityResultSchema.parse(resultInput);
  if (candidate.state !== 'needs_review') throw new Error(`CANDIDATE_PREVIEW_REQUIRES_UNREVIEWED:${candidate.candidateId}`);
  if (result.providerId !== candidate.providerId) throw new Error(`CANDIDATE_PREVIEW_PROVIDER_MISMATCH:${candidate.candidateId}`);
  return CandidateCompatibilityPreviewSchema.parse({
    previewKind: 'candidate-unreviewed', candidateId: candidate.candidateId, providerId: candidate.providerId,
    changeId: candidate.payload.changeId ?? candidate.candidateId, changeTitle: candidate.payload.title,
    officialSourceUrl: candidate.sourceUrl, packageName: result.packageName, declaredVersion: result.declaredVersion,
    resolvedVersion: result.resolvedVersion, status: result.status, exactFile: result.exactFile, exactLine: result.exactLine,
    exactSymbol: result.exactSymbol, reasonCodes: result.reasonCodes, evidenceCoverage: result.evidenceCoverage,
    unknowns: [...unknowns], nextAction: 'MANUAL_REVIEW', reviewStatus: 'needs_review',
  });
}
