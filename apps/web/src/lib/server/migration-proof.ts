import crypto from 'node:crypto';
import { verifyEvidenceBinding, type VerifiedMigrationArtifact } from '@apiproof/core';
import { VerificationReportSchema, type VerificationReport } from '@apiproof/shared';

export interface BoundMigrationProof { evidence: VerifiedMigrationArtifact; report: VerificationReport }

/** One authoritative interpretation for proposal authorization and customer-facing proof. */
export function readBoundMigrationProof(raw: string | null | undefined, expected?: {
  repositoryId: string; baselineSha: string; changeId: string; patchDigest: string;
}): BoundMigrationProof {
  if (!raw) throw new Error('GITHUB_EVIDENCE_MISSING: Verification evidence is required before Draft PR creation.');
  let wrapper: { evidence?: VerifiedMigrationArtifact; report?: VerificationReport; baselineSha?: string; patchDigest?: string };
  try { wrapper = JSON.parse(raw) as typeof wrapper; } catch { throw new Error('GITHUB_EVIDENCE_INVALID: Persisted verification evidence is not valid JSON.'); }
  const evidence = wrapper.evidence;
  const report = VerificationReportSchema.safeParse(wrapper.report);
  const stages = ['INSTALL', 'BUILD', 'TYPECHECK', 'TEST'];
  if (!evidence || !report.success || report.data.status !== 'VERIFICATION_PASSED'
    || wrapper.baselineSha !== (expected?.baselineSha ?? evidence.baselineSha)
    || wrapper.patchDigest !== (expected?.patchDigest ?? evidence.patchDigest)
    || report.data.steps.length !== stages.length
    || report.data.steps.some((step, index) => step.stage !== stages[index] || step.status !== 'PASSED' || step.exitCode !== 0)
    || !report.data.summary.buildPassed || !report.data.summary.typecheckPassed || !report.data.summary.testPassed
    || report.data.networkPolicy.mode !== 'NETWORK_DISABLED' || !report.data.networkPolicy.enforced) {
    throw new Error('GITHUB_EVIDENCE_STALE: Persisted verification evidence is incomplete or belongs to another migration state.');
  }
  if (process.env.NODE_ENV === 'production' && evidence.proofLevel !== 'EXECUTION_VERIFIED') throw new Error('GITHUB_EVIDENCE_INCOMPLETE: Production proposal evidence must be execution-verified.');
  if (evidence.verificationId !== report.data.verificationId || evidence.verificationReportDigest !== crypto.createHash('sha256').update(JSON.stringify(wrapper.report)).digest('hex')) {
    throw new Error('GITHUB_EVIDENCE_MISMATCH: Persisted execution report is not bound to the signed evidence.');
  }
  const binding = verifyEvidenceBinding(evidence, { ...(expected ?? evidence), requireExecutionEvidence: true });
  if (!binding.valid) throw new Error(binding.reason ?? 'GITHUB_EVIDENCE_MISMATCH');
  return { evidence, report: report.data };
}

export function describeMigrationProof(raw: string): string {
  const { evidence, report } = readBoundMigrationProof(raw);
  return [
    `* **Verification Proof**: \`${evidence.proofLevel}\``,
    `* **Verification ID**: \`${report.verificationId}\``,
    `* **Baseline SHA**: \`${evidence.baselineSha}\``,
    `* **Execution Report Digest**: \`${evidence.verificationReportDigest}\``,
    ...report.steps.map((step) => `* **${step.stage}**: ${step.status} (exit ${step.exitCode})`),
    '* **Scope**: Configured isolated checks only; human review is still required.',
  ].join('\n');
}
