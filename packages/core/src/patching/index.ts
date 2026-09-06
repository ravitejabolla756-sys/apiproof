import type { PlanningInput, PatchLimits } from '@apiproof/shared';
import { deterministicPlan } from '../planning/deterministic.js';
import { createPatchWorkspace } from './workspace.js';
import { buildPatchContext } from './context.js';
import { candidate, DeterministicPatchGenerator } from './generator.js';
import type { PatchGenerator } from './generator.js';
import { applyCandidate } from './applicator.js';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export * from './workspace.js';
export * from './policy.js';
export * from './context.js';
export * from './generator.js';
export * from './validator.js';
export * from './applicator.js';
export * from './transforms.js';
export * from './diff.js';
export * from './evaluation.js';

export interface PatchAnalysis { planningInput(repository: string, change: unknown): Promise<PlanningInput> }
export async function runFixturePatch(repository: string, change: unknown, proof: PatchAnalysis, generator: PatchGenerator = new DeterministicPatchGenerator(), limits?: PatchLimits) {
  const workspace = await createPatchWorkspace(repository);
  const planning = await proof.planningInput(workspace.directory, change);
  const input = await buildPatchContext(workspace, planning, deterministicPlan(planning));
  // Even injected generators are never invoked for insufficient-evidence plans.
  let generated;
  try { generated = await (input.supported ? generator : new DeterministicPatchGenerator()).generate(structuredClone(input)); }
  catch { generated = candidate(input); generated.status = 'PATCH_GENERATION_FAILED'; generated.warnings.push('PATCH_GENERATOR_FAILED'); }
  const patch = await applyCandidate(workspace, input, generated, limits);
  await writeFile(path.join(path.dirname(workspace.directory), 'patch.json'), JSON.stringify(patch, null, 2) + '\n', { flag: 'wx' });
  return { patch, workspace };
}
