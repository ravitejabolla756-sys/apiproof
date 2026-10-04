import crypto from 'node:crypto';
import { z } from 'zod';
import { CompatibilityResultSchema, CompatibilityStatusSchema } from './compatibility.js';
import { Digest } from './patching.js';

export const RedGreenVerificationStatusSchema = z.enum(['VERIFICATION_PASSED', 'VERIFICATION_FAILED', 'VERIFICATION_NEEDS_REVIEW']);
export type RedGreenVerificationStatus = z.infer<typeof RedGreenVerificationStatusSchema>;

const GateSchema = z.strictObject({ name: z.enum(['build', 'typecheck', 'test']), passed: z.boolean(), outputDigest: Digest.nullable() });
const SnapshotSchema = z.strictObject({ status: CompatibilityStatusSchema, proofDigest: Digest });

export const RedGreenVerificationResultSchema = z.strictObject({
  verificationId: z.string().min(1), repositoryId: z.string().min(1), baselineSha: Digest, changeId: z.string().min(1),
  before: SnapshotSchema, patch: z.strictObject({ applied: z.boolean(), patchDigest: Digest, targetFiles: z.array(z.string().min(1)).min(1), sourceDigests: z.record(z.string(), Digest), resultingDigests: z.record(z.string(), Digest) }),
  after: SnapshotSchema, gates: z.array(GateSchema).length(3), status: RedGreenVerificationStatusSchema,
  reasonCodes: z.array(z.string()).min(1), evidenceDigest: Digest, requiresHumanReview: z.literal(true),
});
export type RedGreenVerificationResult = z.infer<typeof RedGreenVerificationResultSchema>;

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sameKeys(values: Record<string, string>, targets: readonly string[]): boolean {
  return Object.keys(values).sort().join('\n') === [...targets].sort().join('\n');
}

/** Evaluates red/green evidence only; it never runs commands or applies a patch. */
export function evaluateRedGreenVerification(input: {
  verificationId: string; repositoryId: string; baselineSha: string; changeId: string;
  beforeProof: unknown; afterProof: unknown; patch: { applied: boolean; patchDigest: string; targetFiles: readonly string[]; sourceDigests: Readonly<Record<string, string>>; resultingDigests: Readonly<Record<string, string>> };
  gates: readonly [{ name: 'build'; passed: boolean; outputDigest: string | null }, { name: 'typecheck'; passed: boolean; outputDigest: string | null }, { name: 'test'; passed: boolean; outputDigest: string | null }];
}): RedGreenVerificationResult {
  const before = CompatibilityResultSchema.parse(input.beforeProof);
  const after = CompatibilityResultSchema.parse(input.afterProof);
  const reasons: string[] = [];
  if (before.providerId !== after.providerId || before.changeId !== after.changeId || before.changeId !== input.changeId) reasons.push('PROOF_CHANGE_MISMATCH');
  if (before.status !== 'AFFECTED') reasons.push('BEFORE_NOT_AFFECTED');
  if (after.status !== 'NOT_AFFECTED') reasons.push('AFTER_COMPATIBILITY_NOT_CLEARED');
  if (!input.patch.applied) reasons.push('PATCH_NOT_APPLIED');
  if (!input.patch.targetFiles.length) reasons.push('TARGET_FILES_MISSING');
  if (!sameKeys(input.patch.sourceDigests, input.patch.targetFiles) || !sameKeys(input.patch.resultingDigests, input.patch.targetFiles)) reasons.push('TARGET_DIGEST_BINDING_MISMATCH');
  if (input.gates.some((gate) => !gate.passed)) reasons.push('VERIFICATION_GATE_FAILED');
  const status: RedGreenVerificationStatus = reasons.length === 0 ? 'VERIFICATION_PASSED' : reasons.includes('PROOF_CHANGE_MISMATCH') ? 'VERIFICATION_NEEDS_REVIEW' : 'VERIFICATION_FAILED';
  const beforeSnapshot = { status: before.status, proofDigest: digest(before) };
  const afterSnapshot = { status: after.status, proofDigest: digest(after) };
  const patch = { applied: input.patch.applied, patchDigest: input.patch.patchDigest, targetFiles: [...input.patch.targetFiles], sourceDigests: { ...input.patch.sourceDigests }, resultingDigests: { ...input.patch.resultingDigests } };
  const evidenceDigest = digest({ repositoryId: input.repositoryId, baselineSha: input.baselineSha, changeId: input.changeId, before: beforeSnapshot, patch, after: afterSnapshot, gates: input.gates, status, reasonCodes: reasons.length ? reasons : ['RED_GREEN_PROVEN'] });
  return RedGreenVerificationResultSchema.parse({ verificationId: input.verificationId, repositoryId: input.repositoryId, baselineSha: input.baselineSha, changeId: input.changeId,
    before: beforeSnapshot, patch, after: afterSnapshot, gates: input.gates, status, reasonCodes: reasons.length ? reasons : ['RED_GREEN_PROVEN'], evidenceDigest, requiresHumanReview: true });
}
