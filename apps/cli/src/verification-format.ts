import type { VerificationReport } from '@apiproof/shared';
export function formatVerification(report: VerificationReport): string {
  return ['APIProof Isolated Verification', `Patch: ${report.patchId}`, `Fixture: ${report.fixtureId}`, `Sandbox: ${report.environment.runtime}`, 'Network: Disabled', `Timeout: ${report.resourceLimits.timeoutMs}ms`, '', 'Stages', ...report.steps.map((s)=>`${s.stage.padEnd(20)} ${s.status}`), '', `Result: ${report.status}`, report.summary.statement, 'This verifies only configured fixture checks. It does not prove production safety.', 'Human review required.'].join('\n');
}
