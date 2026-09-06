import { CandidatePatchSchema, DEFAULT_PATCH_LIMITS, PatchLimitsSchema } from '@apiproof/shared';
import type { CandidatePatch, PatchLimits } from '@apiproof/shared';
import type { PatchGenerationInput } from './context.js';
import { candidate } from './generator.js';
import { allowedPatchPath, dangerous, redactPatchContext } from './policy.js';

export function validateCandidate(raw: unknown, input: PatchGenerationInput, limits: PatchLimits = DEFAULT_PATCH_LIMITS): CandidatePatch {
  const parsed = CandidatePatchSchema.safeParse(raw); const fallback = candidate(input);
  if (!parsed.success) return { ...fallback, status: 'PATCH_REJECTED', validation: [{ stage: 'schema', passed: false, code: 'INVALID_PATCH_SCHEMA' }] };
  const patch = parsed.data;
  patch.validation = patch.status === 'PATCH_REJECTED' ? patch.validation.filter((item) => !item.passed && ['model-schema', 'model-target'].includes(item.stage)) : [];
  const stage = (name: string, passed: boolean, code: string): boolean => { patch.validation.push({ stage: name, passed, code: passed ? 'OK' : code }); if (!passed) patch.status = 'PATCH_REJECTED'; return passed; };
  stage('schema', true, '');
  if (!stage('provenance', patch.patchId === fallback.patchId && patch.changeId === fallback.changeId && patch.repositoryId === input.repositoryId && JSON.stringify(patch.planReferences) === JSON.stringify([input.planDigest]) && patch.generatedBy.planDigest === input.planDigest && patch.generatedBy.changeDigest === input.changeDigest && patch.generatedBy.rulesDigest === input.rulesDigest && patch.generatedBy.runId === input.runId && patch.generatedBy.workspace === input.workspace, 'PROVENANCE_MISMATCH')) return patch;
  if (!input.supported) { patch.files = []; patch.status = 'PATCH_INSUFFICIENT_EVIDENCE'; return patch; }
  // Terminal generator refusals cannot be applied, regardless of attached operations.
  if (patch.status !== 'PATCH_READY_FOR_VALIDATION') { patch.files = []; return patch; }
  if (!stage('source-provenance', JSON.stringify(patch.generatedBy.sourceDigests) === JSON.stringify(input.sourceDigests), 'SOURCE_PROVENANCE_MISMATCH')) return patch;
  const evidence = new Set(input.plan.evidence.map((item) => item.id));
  if (!stage('evidence', patch.evidenceReferences.length > 0 && patch.evidenceReferences.every((id) => evidence.has(id)) && patch.files.every((file) => file.edits.every((edit) => edit.evidenceIds.every((id) => evidence.has(id)))), 'UNKNOWN_EVIDENCE')) return patch;
  if (!stage('path', patch.files.every((file) => allowedPatchPath(file.path)), 'UNSAFE_PATCH_PATH')) return patch;
  const allowedFiles = new Set(input.targets.map((target) => target.path));
  if (!stage('allowed-files', patch.files.length > 0 && patch.files.every((file) => allowedFiles.has(file.path)) && new Set(patch.files.map((file) => file.path)).size === patch.files.length, 'UNAUTHORIZED_FILE')) return patch;
  if (!stage('digest-context', patch.files.every((file) => file.edits.length > 0 && file.edits.every((edit) => {
    const target = input.targets.find((item) => item.targetId === edit.targetId && item.path === file.path);
    return target && file.originalDigest === target.originalDigest && edit.start === target.start && edit.end === target.end && edit.expected === target.expected;
  })), 'SOURCE_CONTEXT_MISMATCH')) return patch;
  const settings = PatchLimitsSchema.parse(limits); const edits = patch.files.flatMap((file) => file.edits);
  const lines = edits.reduce((sum, edit) => sum + edit.expected.split('\n').length + edit.replacement.split('\n').length, 0);
  if (!stage('diff-size', patch.files.length <= settings.maxFiles && edits.length <= settings.maxEdits && lines <= settings.maxChangedLines && edits.every((edit) => edit.replacement.length <= settings.maxReplacementChars), 'PATCH_SIZE_LIMIT')) return patch;
  if (!stage('secret-output', edits.every((edit) => !redactPatchContext(edit.replacement).redacted), 'SECRET_LIKE_MODEL_OUTPUT')) { patch.files = []; return patch; }
  if (!stage('dangerous-patterns', edits.every((edit) => !dangerous(edit.replacement)), 'DANGEROUS_ADDITION')) return patch;
  if (!stage('semantic-scope', edits.length === input.targets.length && new Set(edits.map((edit) => edit.targetId)).size === edits.length && input.targets.every((target) => edits.some((edit) => edit.targetId === target.targetId && edit.replacement === target.replacement && target.evidenceIds.every((id) => edit.evidenceIds.includes(id)))) && patch.files.every((file) => {
    const sorted = [...file.edits].sort((a, b) => a.start - b.start); return sorted.every((edit, index) => index === 0 || sorted[index - 1]!.end <= edit.start);
  }), 'UNSUPPORTED_TRANSFORMATION')) return patch;
  // Diffs and patched digests are always recomputed by the applicator.
  patch.files.forEach((file) => { file.unifiedDiff = ''; file.patchedDigest = null; });
  return patch;
}
