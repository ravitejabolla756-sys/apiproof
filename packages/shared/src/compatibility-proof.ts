import { z } from 'zod';
import { CompatibilityResultSchema } from './compatibility.js';

const RepositoryIdSchema = z.string().min(1).max(200);
const BaselineShaSchema = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/, 'Baseline SHA must be a lowercase 40- or 64-character digest.');
const ScanIdSchema = z.string().min(1).max(200);

/** A repository-bound, immutable compatibility explanation. */
export const CompatibilityProofSchema = CompatibilityResultSchema.extend({
  proofId: z.string().min(1).max(500),
  repositoryId: RepositoryIdSchema,
  baselineSha: BaselineShaSchema,
  scanId: ScanIdSchema,
});
export type CompatibilityProof = z.infer<typeof CompatibilityProofSchema>;

export interface CompatibilityProofSnapshotInput {
  repositoryId: string;
  baselineSha: string;
  scanId: string;
  results: readonly unknown[];
  mode?: 'production' | 'test';
}

const proofIdentity = (repositoryId: string, baselineSha: string, scanId: string, result: z.infer<typeof CompatibilityResultSchema>): string =>
  [repositoryId, baselineSha, scanId, result.providerId, result.changeId, result.exactFile ?? '', result.exactLine ?? ''].join(':');

/**
 * Binds evaluator output to one repository baseline and scan. Production mode
 * fails closed by omitting non-reviewed or non-official records; it never
 * promotes a synthetic fixture into a customer-visible proof.
 */
export function buildCompatibilityProofSnapshot(input: CompatibilityProofSnapshotInput): CompatibilityProof[] {
  const repositoryId = RepositoryIdSchema.parse(input.repositoryId);
  const baselineSha = BaselineShaSchema.parse(input.baselineSha);
  const scanId = ScanIdSchema.parse(input.scanId);
  const proofs = new Map<string, CompatibilityProof>();
  for (const raw of input.results) {
    const result = CompatibilityResultSchema.parse(raw);
    if (input.mode !== 'test' && (result.reviewStatus === 'draft' || result.provenance !== 'official')) continue;
    const proof = CompatibilityProofSchema.parse({ ...result, proofId: proofIdentity(repositoryId, baselineSha, scanId, result), repositoryId, baselineSha, scanId });
    proofs.set(proof.proofId, proof);
  }
  return [...proofs.values()].sort((a, b) => a.proofId.localeCompare(b.proofId, 'en'));
}
