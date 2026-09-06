import { CandidatePatchSchema, StructuredPatchOutputSchema, TOOL_VERSION } from '@apiproof/shared';
import type { CandidatePatch, StructuredPatchOutput } from '@apiproof/shared';
import type { PatchGenerationInput } from './context.js';

export interface PatchGenerator { generate(input: PatchGenerationInput): Promise<CandidatePatch> }
export function candidate(input: PatchGenerationInput, implementation = 'deterministic', model: string | null = null, aiUsed = false): CandidatePatch {
  return CandidatePatchSchema.parse({ patchId: `patch-${input.runId}`, changeId: input.plan.changeId, repositoryId: input.repositoryId,
    status: input.supported ? 'PATCH_READY_FOR_VALIDATION' : 'PATCH_INSUFFICIENT_EVIDENCE', files: [],
    evidenceReferences: input.plan.evidence.filter((item) => ['change', 'impact'].includes(item.kind)).map((item) => item.id), planReferences: [input.planDigest], warnings: [...input.warnings, 'NOT EXECUTED. NOT VERIFIED. NOT COMMITTED. Human review required.'], validation: [],
    generatedBy: { implementation, version: TOOL_VERSION, model, aiUsed, changeDigest: input.changeDigest, rulesDigest: input.rulesDigest, planDigest: input.planDigest, sourceDigests: input.sourceDigests, runId: input.runId, workspace: input.workspace }, requiresHumanReview: true });
}
export class DeterministicPatchGenerator implements PatchGenerator {
  async generate(input: PatchGenerationInput): Promise<CandidatePatch> {
    const patch = candidate(input); if (!input.supported) return patch;
    for (const target of input.targets) {
      let file = patch.files.find((item) => item.path === target.path);
      if (!file) { file = { path: target.path, originalDigest: target.originalDigest, patchedDigest: null, edits: [], unifiedDiff: '' }; patch.files.push(file); }
      file.edits.push({ targetId: target.targetId, operation: target.operation, start: target.start, end: target.end, expected: target.expected, replacement: target.replacement, evidenceIds: [...target.evidenceIds] });
    }
    return patch;
  }
}
export interface StructuredPatchModel {
  readonly modelId: string;
  readonly usesAI: boolean;
  generate(request: Pick<PatchGenerationInput, 'plan' | 'targets' | 'snippets' | 'instructions'>): Promise<unknown>;
}
export class LLMPatchGenerator implements PatchGenerator {
  constructor(private readonly provider?: StructuredPatchModel) {}
  async generate(input: PatchGenerationInput): Promise<CandidatePatch> {
    const patch = candidate(input, 'structured-model', this.provider?.modelId ?? null, this.provider?.usesAI ?? false);
    if (!input.supported) return patch;
    if (!this.provider) { patch.status = 'PATCH_GENERATION_FAILED'; patch.warnings.push('MODEL_UNAVAILABLE'); return patch; }
    try {
      const raw = await this.provider.generate(structuredClone({ plan: input.plan, targets: input.targets, snippets: input.snippets, instructions: input.instructions }));
      const output = StructuredPatchOutputSchema.safeParse(raw);
      if (!output.success) { patch.status = 'PATCH_REJECTED'; patch.validation.push({ stage: 'model-schema', passed: false, code: 'INVALID_MODEL_OUTPUT' }); return patch; }
      for (const edit of output.data.edits) {
        const target = input.targets.find((item) => item.targetId === edit.targetId);
        if (!target) { patch.status = 'PATCH_REJECTED'; patch.validation.push({ stage: 'model-target', passed: false, code: 'UNAUTHORIZED_TARGET' }); patch.files = []; return patch; }
        let file = patch.files.find((item) => item.path === target.path);
        if (!file) { file = { path: target.path, originalDigest: target.originalDigest, patchedDigest: null, edits: [], unifiedDiff: '' }; patch.files.push(file); }
        file.edits.push({ targetId: target.targetId, operation: 'replace-range', start: target.start, end: target.end, expected: target.expected, replacement: edit.replacement, evidenceIds: edit.evidenceIds });
      }
      return patch;
    } catch { patch.status = 'PATCH_GENERATION_FAILED'; patch.warnings.push('MODEL_PROVIDER_FAILED'); return patch; }
  }
}
/** Repeatable injected provider. It never reads files or calls a network service. */
export class FakeStructuredPatchModel implements StructuredPatchModel {
  readonly modelId = 'fake-structured-patch-v1';
  readonly usesAI = false;
  constructor(private readonly respond?: (output: StructuredPatchOutput) => unknown) {}
  async generate(request: Parameters<StructuredPatchModel['generate']>[0]): Promise<unknown> {
    const output = { edits: request.targets.map(({ targetId, replacement, evidenceIds }) => ({ targetId, replacement, evidenceIds })) };
    return this.respond ? this.respond(output) : output;
  }
}
