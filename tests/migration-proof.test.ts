import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createVerificationEvidence } from '@apiproof/core';
import type { VerificationReport } from '@apiproof/shared';
import { readBoundMigrationProof, describeMigrationProof } from '../apps/web/src/lib/server/migration-proof.js';
import { getMigrationLifecycleState } from '../apps/web/src/lib/server/migration-lifecycle.js';

/** Unit contract data, not a claim that these checks executed in Docker. */
export function signedUnitProof() {
  const report: VerificationReport = {
    verificationId: 'unit-verification', patchId: 'unit-patch', fixtureId: 'unit-fixture', status: 'VERIFICATION_PASSED', workspace: 'unit-workspace',
    steps: (['INSTALL', 'BUILD', 'TYPECHECK', 'TEST'] as const).map((stage) => ({ stage, status: 'PASSED', exitCode: 0, durationMs: 1, stdout: '', stderr: '', stdoutDigest: null, stderrDigest: null, stdoutTruncated: false, stderrTruncated: false })),
    summary: { buildPassed: true, typecheckPassed: true, testPassed: true, statement: 'Unit contract data' },
    environment: { runtime: 'unit', node: 'unit', lifecycleScriptsEnabled: false, inheritedEnvironment: [] },
    networkPolicy: { mode: 'NETWORK_DISABLED', enforced: true }, resourceLimits: { timeoutMs: 90000, memoryMb: 768, maxOutputBytes: 65536, cpu: 'bounded' }, artifacts: [], warnings: [], requiresHumanReview: true,
  };
  const evidence = createVerificationEvidence({ repositoryId: 'unit-repository', baselineSha: 'a'.repeat(40), changeId: 'unit-change', patchDigest: 'b'.repeat(64), proofLevel: 'EXECUTION_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true, verificationId: report.verificationId, verificationStatus: report.status, verificationReportDigest: crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'), targetFiles: ['src/index.ts'], sourceDigests: { 'src/index.ts': 'c'.repeat(64) }, resultingDigests: { 'src/index.ts': 'd'.repeat(64) } });
  return { baselineSha: evidence.baselineSha, patchDigest: evidence.patchDigest, report, evidence };
}

describe('persisted migration proof and PR wording', () => {
  it('describes the exact recorded proof rather than a hardcoded contract/gate count', () => {
    const wrapper = signedUnitProof();
    const body = describeMigrationProof(JSON.stringify(wrapper));
    expect(body).toContain('EXECUTION_VERIFIED');
    expect(body).toContain(wrapper.report.verificationId);
    expect(body).toContain(wrapper.evidence.verificationReportDigest);
    for (const stage of wrapper.report.steps) expect(body).toContain(`**${stage.stage}**: PASSED (exit 0)`);
    expect(body).not.toContain('CONTRACT_VERIFIED');
    expect(body).not.toContain('4/4');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: JSON.stringify(wrapper) })).toBe('Verification Passed');
  });
  it.each(['missing stage', 'failed stage', 'changed report', 'changed baseline', 'changed digest'])('rejects %s without allowing verified UI/proposal wording', (kind) => {
    const wrapper = signedUnitProof();
    if (kind === 'missing stage') wrapper.report.steps.pop();
    if (kind === 'failed stage') wrapper.report.steps[3]!.exitCode = 1;
    if (kind === 'changed report') wrapper.report.warnings.push('tampered');
    if (kind === 'changed baseline') wrapper.baselineSha = 'e'.repeat(40);
    if (kind === 'changed digest') wrapper.patchDigest = 'f'.repeat(64);
    const raw = JSON.stringify(wrapper);
    expect(() => readBoundMigrationProof(raw)).toThrow(/GITHUB_EVIDENCE/);
    expect(() => describeMigrationProof(raw)).toThrow(/GITHUB_EVIDENCE/);
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: raw })).toBe('Verification Pending');
  });
});
