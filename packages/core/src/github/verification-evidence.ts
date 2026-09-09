import crypto from 'node:crypto';
import type { ProofLevel } from './types.js';

export interface VerificationEvidence {
  baselineSha: string;
  patchDigest: string;
  changeId: string;
  repositoryId: string;
  proofLevel: ProofLevel;
  patchApplied: boolean;
  typecheckPassed: boolean;
  testsPassed: boolean;
  contractPassed: boolean;
  evidenceDigest: string;
  verifiedAt: string;
}

export function computeEvidenceDigest(input: {
  baselineSha: string;
  patchDigest: string;
  changeId: string;
  repositoryId: string;
  proofLevel: ProofLevel;
  patchApplied: boolean;
  typecheckPassed: boolean;
  testsPassed: boolean;
  contractPassed: boolean;
}): string {
  const hash = crypto.createHash('sha256');
  hash.update(
    `${input.repositoryId}:${input.baselineSha}:${input.changeId}:${input.patchDigest}:${input.proofLevel}:${input.patchApplied}:${input.typecheckPassed}:${input.testsPassed}:${input.contractPassed}`
  );
  return hash.digest('hex');
}

export function createVerificationEvidence(input: {
  baselineSha: string;
  patchDigest: string;
  changeId: string;
  repositoryId: string;
  proofLevel: ProofLevel;
  patchApplied: boolean;
  typecheckPassed: boolean;
  testsPassed: boolean;
  contractPassed: boolean;
}): VerificationEvidence {
  const evidenceDigest = computeEvidenceDigest(input);
  return {
    ...input,
    evidenceDigest,
    verifiedAt: new Date().toISOString(),
  };
}

export function verifyEvidenceBinding(
  evidence: VerificationEvidence | undefined | null,
  expected: {
    baselineSha: string;
    patchDigest: string;
    changeId: string;
    repositoryId: string;
  }
): { valid: boolean; reason?: string } {
  if (!evidence) {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISSING: Verification evidence object is missing.' };
  }
  if (!evidence.patchApplied || !evidence.typecheckPassed || !evidence.testsPassed || !evidence.contractPassed) {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISMATCH: Verification checks did not all pass.' };
  }
  if (evidence.proofLevel !== 'CONTRACT_VERIFIED' && evidence.proofLevel !== 'EXECUTION_VERIFIED' && evidence.proofLevel !== 'STATIC_VERIFIED') {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISMATCH: Verification proof level is insufficient.' };
  }
  if (evidence.repositoryId !== expected.repositoryId) {
    return { valid: false, reason: `GITHUB_EVIDENCE_MISMATCH: Evidence repositoryId (${evidence.repositoryId}) does not match request repositoryId (${expected.repositoryId}).` };
  }
  if (evidence.baselineSha !== expected.baselineSha) {
    return { valid: false, reason: `GITHUB_EVIDENCE_MISMATCH: Evidence baselineSha (${evidence.baselineSha}) does not match request baselineSha (${expected.baselineSha}).` };
  }
  if (evidence.changeId !== expected.changeId) {
    return { valid: false, reason: `GITHUB_EVIDENCE_MISMATCH: Evidence changeId (${evidence.changeId}) does not match request changeId (${expected.changeId}).` };
  }
  if (evidence.patchDigest !== expected.patchDigest) {
    return { valid: false, reason: `GITHUB_EVIDENCE_MISMATCH: Evidence patchDigest (${evidence.patchDigest}) does not match request patchDigest (${expected.patchDigest}).` };
  }
  const expectedDigest = computeEvidenceDigest(evidence);
  if (evidence.evidenceDigest !== expectedDigest) {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISMATCH: Evidence digest integrity check failed.' };
  }
  return { valid: true };
}
