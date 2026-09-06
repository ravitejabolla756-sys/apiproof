import type { CandidatePatch } from '@apiproof/shared';
export function formatPatch(patch: CandidatePatch): string {
  return ['APIProof Candidate Patch', `Status: ${patch.status}`, `Change: ${patch.changeId}`, `Source fixture: ${patch.repositoryId}`, `Workspace: ${patch.generatedBy.workspace}`, '',
    ...patch.files.map((file) => file.unifiedDiff || `Proposed file: ${file.path}`),
    ...patch.validation.map((stage) => `${stage.passed ? 'PASS' : 'FAIL'} ${stage.stage}: ${stage.code}`),
    ...patch.warnings, '', 'NOT EXECUTED. NOT VERIFIED. NOT COMMITTED.', 'Human review required.'].join('\n');
}
