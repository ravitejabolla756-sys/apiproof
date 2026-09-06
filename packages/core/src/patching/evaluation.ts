import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CandidatePatchSchema } from '@apiproof/shared';
import type { CandidatePatch, RegistryChange } from '@apiproof/shared';
import type { PatchAnalysis } from './index.js';
import { deterministicPlan } from '../planning/deterministic.js';
import { createPatchWorkspace, patchCorpusRoot, workspaceFileNames } from './workspace.js';
import { buildPatchContext } from './context.js';
import { DeterministicPatchGenerator, LLMPatchGenerator, FakeStructuredPatchModel } from './generator.js';
import { applyCandidate } from './applicator.js';
import { syntaxValid } from './transforms.js';
import { sha256, assertPlainPath } from './policy.js';

export interface PatchCase { id: string; repository: string; changeId: string; mode: string; expectedStatus: CandidatePatch['status']; expectedFiles: string[]; mustContain: string[]; mustRemove: string[]; mustNotTouch: string[]; explanation: string }
export async function patchCases(): Promise<PatchCase[]> {
  const file = path.join(patchCorpusRoot, 'labels/cases.json'); await assertPlainPath(file);
  const body = JSON.parse(await readFile(file, 'utf8')) as { cases: PatchCase[] };
  return body.cases;
}
export async function evaluatePatchCase(label: PatchCase, registry: RegistryChange[], proof: PatchAnalysis) {
  const change = registry.find((item) => item.id === label.changeId); if (!change) throw new Error('Missing evaluation change.');
  const workspace = await createPatchWorkspace(path.join(patchCorpusRoot, 'corpus', label.repository));
  const planning = await proof.planningInput(workspace.directory, change);
  const input = await buildPatchContext(workspace, planning, deterministicPlan(planning));
  const useFake = !['deterministic', 'stale-digest'].includes(label.mode);
  const generator = useFake ? new LLMPatchGenerator(new FakeStructuredPatchModel((output) => {
    const edit = output.edits[0]; if (!edit) return output;
    switch (label.mode) {
      case 'traversal': return { edits: [{ ...edit, path: '../../README.md' }] };
      case 'env': return { edits: [{ ...edit, path: '.env' }] };
      case 'dependency-file': return { edits: [{ ...edit, path: 'package.json' }] };
      case 'unauthorized-file': return { edits: [{ ...edit, targetId: 'src/auth.ts' }] };
      case 'dangerous': edit.replacement = "discounts: child_process.exec('unsafe')"; break;
      case 'whole-file': return { edits: [{ ...edit, start: 0, end: 10000 }] };
      case 'evidence': edit.evidenceIds = ['impact:nonexistent']; break;
      case 'oversized': edit.replacement = 'x'.repeat(9000); break;
      case 'new-dependency': edit.replacement = "discounts: require('invented-package')()"; break;
      case 'syntax': edit.replacement = 'discounts: [{'; break;
    }
    return output;
  })) : new DeterministicPatchGenerator();
  const raw = await generator.generate(input);
  if (label.mode === 'stale-digest' && raw.files[0]) raw.files[0].originalDigest = '0'.repeat(64);
  const patch = await applyCandidate(workspace, input, raw);
  const changed: string[] = []; const texts: Record<string, string> = {}; let originalsUnchanged = true;
  for (const [file, source] of Object.entries(workspace.snapshot)) {
    texts[file] = await readFile(path.join(workspace.directory, file), 'utf8');
    if (sha256(texts[file]!) !== sha256(source)) changed.push(file);
    if (sha256(await readFile(path.join(workspace.originalDirectory, file))) !== sha256(source)) originalsUnchanged = false;
  }
  changed.push(...(await workspaceFileNames(workspace)).filter((file) => !(file in workspace.snapshot)));
  const supported = label.expectedStatus === 'PATCH_READY_FOR_VALIDATION';
  const unexpectedFiles = changed.filter((file) => !label.expectedFiles.includes(file));
  const dependencyEdits = changed.filter((file) => label.mustNotTouch.includes(file));
  const expectedTransform = !supported || label.expectedFiles.every((file) => changed.includes(file) && label.mustContain.every((text) => texts[file]!.includes(text)) && label.mustRemove.every((text) => !texts[file]!.includes(text)));
  const syntax = supported && changed.length > 0 && changed.every((file) => syntaxValid(file, texts[file]!));
  const invention = patch.status === 'PATCH_READY_FOR_VALIDATION' && patch.files.some((file) => file.edits.some((edit) => !input.targets.some((target) => target.targetId === edit.targetId && target.replacement === edit.replacement)));
  const pathCase = ['traversal', 'env', 'dependency-file', 'unauthorized-file'].includes(label.mode);
  return { id: label.id, mode: label.mode, supported, status: patch.status, expectedStatus: label.expectedStatus,
    schemaValid: CandidatePatchSchema.safeParse(patch).success, statusCorrect: patch.status === label.expectedStatus,
    authorizedFiles: unexpectedFiles.length === 0, expectedTransform, syntax, unexpectedFiles: unexpectedFiles.length, dependencyEdits: dependencyEdits.length,
    originalsUnchanged, unsupportedFactInventions: Number(invention), pathCase, pathRejected: pathCase && patch.status === 'PATCH_REJECTED' && changed.length === 0,
    malicious: !['deterministic', 'fake-valid'].includes(label.mode), rejectedWithoutWrites: patch.status === 'PATCH_REJECTED' && changed.length === 0,
    digestCase: label.mode === 'stale-digest', digestRejected: label.mode === 'stale-digest' && patch.status === 'PATCH_REJECTED' && changed.length === 0,
    generationFailure: patch.status === 'PATCH_GENERATION_FAILED', patch };
}
export async function evaluatePatchCorpus(registry: RegistryChange[], proof: PatchAnalysis) {
  const labels = await patchCases(); const results: Awaited<ReturnType<typeof evaluatePatchCase>>[] = []; const failures: string[] = [];
  for (const label of labels) { try { results.push(await evaluatePatchCase(label, registry, proof)); } catch { failures.push(label.id); } }
  const count = (fn: (r: typeof results[number]) => boolean) => results.filter(fn).length;
  const metrics = {
    cases: labels.length, schemaValidPatches: count((r) => r.schemaValid), correctStatuses: count((r) => r.statusCorrect), authorizedFiles: count((r) => r.authorizedFiles),
    supportedCases: labels.filter((r) => r.expectedStatus === 'PATCH_READY_FOR_VALIDATION').length,
    expectedTransformations: count((r) => r.supported && r.expectedTransform), syntaxValidSupported: count((r) => r.syntax),
    unexpectedFilesModified: results.reduce((s, r) => s + r.unexpectedFiles, 0), forbiddenDependencyModifications: results.reduce((s, r) => s + r.dependencyEdits, 0),
    forbiddenTransformationRate: results.length ? count((r) => r.unsupportedFactInventions > 0 || r.unexpectedFiles > 0 || r.dependencyEdits > 0) / results.length : null,
    pathSafetyCases: count((r) => r.pathCase), pathSafetyRejections: count((r) => r.pathRejected),
    maliciousCases: count((r) => r.malicious), maliciousRejections: count((r) => r.malicious && r.rejectedWithoutWrites),
    maliciousFakeModelCases: count((r) => r.malicious && r.mode !== 'stale-digest'), maliciousFakeModelRejections: count((r) => r.malicious && r.mode !== 'stale-digest' && r.rejectedWithoutWrites),
    digestMismatchCases: count((r) => r.digestCase), digestMismatchRejections: count((r) => r.digestRejected),
    unsupportedFactInventions: results.reduce((s, r) => s + r.unsupportedFactInventions, 0), generationFailures: count((r) => r.generationFailure), harnessFailures: failures,
    originalFixtureChanges: count((r) => !r.originalsUnchanged),
    deterministicSupported: count((r) => r.mode === 'deterministic' && r.supported), deterministicSuccessful: count((r) => r.mode === 'deterministic' && r.supported && r.statusCorrect && r.expectedTransform && r.syntax),
  };
  const passed = failures.length === 0 && results.every((r) => r.schemaValid && r.statusCorrect && r.authorizedFiles && r.expectedTransform && r.originalsUnchanged && (!r.supported || r.syntax) && !r.unsupportedFactInventions && (!r.malicious || r.rejectedWithoutWrites));
  return { schemaVersion: '1.0', provenance: 'authored-synthetic-patch-cases', passed, metrics, results: results.map(({ patch: _patch, ...result }) => result) };
}
