import crypto from 'node:crypto';
import type { ProofLevel } from './types.js';

export function getVerifierSecret(secretOverride?: string): string {
  if (secretOverride && secretOverride.trim().length > 0) {
    return secretOverride.trim();
  }
  const secret = process.env.APIPROOF_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('VERIFIER_SECRET_MISSING: Production requires APIPROOF_SECRET (or AUTH_SECRET) to be configured in environment variables.');
  }
  return 'apiproof-dev-verifier-secret-stable-key-32b';
}

export interface VerifiedMigrationArtifact {
  readonly artifactId: string;
  readonly repositoryId: string;
  readonly baselineSha: string;
  readonly changeId: string;
  readonly patchDigest: string;
  readonly proofLevel: ProofLevel;
  readonly patchApplied: boolean;
  readonly typecheckPassed: boolean;
  readonly testsPassed: boolean;
  readonly contractPassed: boolean;
  readonly verifiedAt: string;
  readonly evidenceDigest: string;
  readonly provenanceToken: string;
}

export type VerificationEvidence = VerifiedMigrationArtifact;

export function computeCanonicalPatchDigest(patchFiles: Record<string, string>): string {
  const sortedPaths = Object.keys(patchFiles).sort();
  const hash = crypto.createHash('sha256');
  for (const filePath of sortedPaths) {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const content = patchFiles[filePath] ?? '';
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    hash.update(`${normalizedPath}\n${content.length}\n${contentHash}\n`);
  }
  return hash.digest('hex');
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

function computeProvenanceToken(input: {
  repositoryId: string;
  baselineSha: string;
  changeId: string;
  patchDigest: string;
  proofLevel: ProofLevel;
  evidenceDigest: string;
}, secretOverride?: string): string {
  const secretKey = getVerifierSecret(secretOverride);
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(
    `${input.repositoryId}:${input.baselineSha}:${input.changeId}:${input.patchDigest}:${input.proofLevel}:${input.evidenceDigest}`
  );
  return hmac.digest('hex');
}

export class MigrationVerifier {
  static verify(input: {
    repositoryId: string;
    baselineSha: string;
    changeId: string;
    patchDigest: string;
    proofLevel: ProofLevel;
    patchApplied: boolean;
    typecheckPassed: boolean;
    testsPassed: boolean;
    contractPassed: boolean;
  }, secretOverride?: string): VerifiedMigrationArtifact {
    const verifiedAt = new Date().toISOString();
    const evidenceDigest = computeEvidenceDigest(input);
    const provenanceToken = computeProvenanceToken({
      repositoryId: input.repositoryId,
      baselineSha: input.baselineSha,
      changeId: input.changeId,
      patchDigest: input.patchDigest,
      proofLevel: input.proofLevel,
      evidenceDigest,
    }, secretOverride);

    return Object.freeze({
      artifactId: `artifact-${crypto.randomBytes(8).toString('hex')}`,
      ...input,
      verifiedAt,
      evidenceDigest,
      provenanceToken,
    });
  }
}

export function createVerificationEvidence(
  input: {
    baselineSha: string;
    patchDigest: string;
    changeId: string;
    repositoryId: string;
    proofLevel: ProofLevel;
    patchApplied: boolean;
    typecheckPassed: boolean;
    testsPassed: boolean;
    contractPassed: boolean;
  },
  secretOverride?: string
): VerifiedMigrationArtifact {
  return MigrationVerifier.verify(input, secretOverride);
}

export function verifyEvidenceBinding(
  evidence: VerifiedMigrationArtifact | undefined | null,
  expected: {
    baselineSha: string;
    patchDigest: string;
    changeId: string;
    repositoryId: string;
  },
  secretOverride?: string
): { valid: boolean; reason?: string } {
  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISSING: Verification evidence object is missing.' };
  }
  if (!evidence.provenanceToken) {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISMATCH: Evidence lacks verifier provenance token (untrusted or forged evidence).' };
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

  const expectedProvenanceToken = computeProvenanceToken({
    repositoryId: evidence.repositoryId,
    baselineSha: evidence.baselineSha,
    changeId: evidence.changeId,
    patchDigest: evidence.patchDigest,
    proofLevel: evidence.proofLevel,
    evidenceDigest: evidence.evidenceDigest,
  }, secretOverride);

  if (evidence.provenanceToken !== expectedProvenanceToken) {
    return { valid: false, reason: 'GITHUB_EVIDENCE_MISMATCH: Verifier provenance signature check failed (forged evidence).' };
  }

  return { valid: true };
}
