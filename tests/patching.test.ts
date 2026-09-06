import { readFile, writeFile, symlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { CandidatePatchSchema } from '@apiproof/shared';
import { loadStripeRegistry } from '@apiproof/providers';
import { allowedPatchPath, createPatchWorkspace, buildPatchContext, deterministicPlan, DeterministicPatchGenerator, LLMPatchGenerator, FakeStructuredPatchModel, validateCandidate, applyCandidate, evaluatePatchCase, patchCases, checkWorkspace, runFixturePatch, redactPatchContext, syntaxValid, unifiedDiff, editDiff } from '@apiproof/core';
import { proof, root, repository } from './helpers.js';

const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
const labels = await patchCases();
const fixture = path.join(root, 'evaluation-patches/corpus/coupon-basic');
async function setup(id = 'coupon-basic', changeId = 'stripe-subscription-coupon-removed') {
  const workspace = await createPatchWorkspace(path.join(root, 'evaluation-patches/corpus', id));
  const planning = await proof.planningInput(workspace.directory, registry.find((c) => c.id === changeId)!);
  const input = await buildPatchContext(workspace, planning, deterministicPlan(planning));
  const patch = await new DeterministicPatchGenerator().generate(input);
  return { workspace, input, patch };
}
describe('patch paths', () => {
  it.each(['src/billing.ts', 'src/routes/billing.ts', 'src/Widget.tsx'])('allows %s', (file) => expect(allowedPatchPath(file)).toBe(true));
  it.each(['src/CON.ts', 'src/aux.ts', 'src/COM1.ts', 'src/LPT9/file.ts'])('rejects Windows device path %s', (file) => expect(allowedPatchPath(file)).toBe(false));
  it.each(['../../README.md', '../src/a.ts', '/src/a.ts', 'C:/src/a.ts', 'C:\\src\\a.ts', '\\\\server\\src\\a.ts', 'src/../a.ts', 'src/%2e%2e/a.ts', 'src\\a.ts', 'src//a.ts', 'src/a.ts:stream', 'src/a.ts.', 'src/a.ts ', 'src/a\u0000.ts', '.git/config', '.env', 'src/.env.ts', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'src/node_modules/a.ts', 'src/build/a.ts', 'src/dist/a.ts', 'src/credentials.ts', 'src/config.ts', 'src/secrets/a.ts', 'src/a.js', 'src/a.png', 'src/a.d.ts'])('rejects %s', (file) => expect(allowedPatchPath(file)).toBe(false));
});
describe('authored patch evaluation', () => {
  it.each(labels)('$id', async (label) => {
    const result = await evaluatePatchCase(label, registry, proof);
    expect(result.statusCorrect, JSON.stringify(result.patch)).toBe(true);
    expect(result.schemaValid).toBe(true); expect(result.authorizedFiles).toBe(true);
    expect(result.expectedTransform).toBe(true); expect(result.originalsUnchanged).toBe(true);
    expect(result.dependencyEdits).toBe(0); expect(result.unsupportedFactInventions).toBe(0);
    if (result.supported) expect(result.syntax).toBe(true);
    if (result.malicious) expect(result.rejectedWithoutWrites).toBe(true);
  });
});
describe('workspace and model trust boundary', () => {
  it('refuses arbitrary repositories, original corpora and the tool itself', async () => {
    for (const directory of [root, path.join(root, 'evaluation-plans/corpus/coupon-direct'), await repository()]) await expect(createPatchWorkspace(directory)).rejects.toMatchObject({ code: 'FIXTURE_ONLY' });
  });
  it('refuses forged workspace handles', async () => {
    const { workspace } = await setup(); await expect(checkWorkspace({ ...workspace, directory: root })).rejects.toMatchObject({ code: 'UNISSUED_WORKSPACE' });
  });
  it('rejects forged and cross-workspace contexts and ignores caller mutations', async () => {
    const { workspace, input, patch } = await setup(); const other = await createPatchWorkspace(fixture);
    await expect(applyCandidate(other, input, patch)).rejects.toMatchObject({ code: 'UNISSUED_PATCH_CONTEXT' });
    await expect(applyCandidate(workspace, structuredClone(input), patch)).rejects.toMatchObject({ code: 'UNISSUED_PATCH_CONTEXT' });
    input.targets[0]!.replacement = 'discounts: [{ coupon: attacker }]'; patch.files[0]!.edits[0]!.replacement = input.targets[0]!.replacement;
    expect((await applyCandidate(workspace, input, patch)).status).toBe('PATCH_REJECTED');
    await checkWorkspace(workspace);
  });
  it('rejects stale source without overwriting the unexpected edit', async () => {
    const { workspace, input, patch } = await setup();
    const file = path.join(workspace.directory, 'src/billing.ts'); await writeFile(file, 'export const changed = true;');
    const result = await applyCandidate(workspace, input, patch);
    expect(result.status).toBe('PATCH_REJECTED'); expect(await readFile(file, 'utf8')).toBe('export const changed = true;');
  });
  it('rejects directory junctions at apply without touching their target', async () => {
    const { workspace, input, patch } = await setup(); const external = await repository({ 'billing.ts': 'export const outside = true;' });
    await rename(path.join(workspace.directory, 'src'), path.join(workspace.directory, 'original-src'));
    await symlink(external, path.join(workspace.directory, 'src'), process.platform === 'win32' ? 'junction' : 'dir');
    expect((await applyCandidate(workspace, input, patch)).status).toBe('PATCH_REJECTED');
    expect(await readFile(path.join(external, 'billing.ts'), 'utf8')).toBe('export const outside = true;');
  });
  it('never invokes a generator for insufficient evidence', async () => {
    let calls = 0;
    const result = await runFixturePatch(path.join(root, 'evaluation-patches/corpus/wrapper'), registry.find((c) => c.id === 'stripe-subscription-coupon-removed')!, proof, { generate: async () => { calls++; throw new Error('must not run'); } });
    expect(calls).toBe(0); expect(result.patch.status).toBe('PATCH_INSUFFICIENT_EVIDENCE');
  });
  it('returns MODEL_UNAVAILABLE and sanitizes provider failures', async () => {
    const { input } = await setup(); const unavailable = await new LLMPatchGenerator().generate(input);
    expect(unavailable.status).toBe('PATCH_GENERATION_FAILED'); expect(unavailable.warnings).toContain('MODEL_UNAVAILABLE');
    const failed = await new LLMPatchGenerator({ modelId: 'test', usesAI: false, generate: async () => { throw new Error('secret_error'); } }).generate(input);
    expect(failed.status).toBe('PATCH_GENERATION_FAILED'); expect(JSON.stringify(failed)).not.toContain('secret_error');
  });
  it('reports a thrown injected generator as a structured failure', async () => {
    const result = await runFixturePatch(fixture, registry.find((c) => c.id === 'stripe-subscription-coupon-removed')!, proof, { generate: async () => { throw new Error('sensitive_error'); } });
    expect(result.patch.status).toBe('PATCH_GENERATION_FAILED'); expect(JSON.stringify(result.patch)).not.toContain('sensitive_error');
    await checkWorkspace(result.workspace);
  });
  it('gives the model bounded context without runtime workspace paths', async () => {
    const { input } = await setup(); let request: unknown;
    const generated = await new LLMPatchGenerator({ modelId: 'inspection', usesAI: false, generate: async (value) => { request = value; return new FakeStructuredPatchModel().generate(value); } }).generate(input);
    expect(generated.generatedBy.aiUsed).toBe(false);
    const text = JSON.stringify(request); expect(text.length).toBeLessThan(30_000); expect(text).not.toContain(input.workspace); expect(text).not.toContain('package-lock.json');
  });
  it('redacts common credentials and environment access', () => {
    const value = redactPatchContext("const password = 'hidden'; const apiKey = 'private'; process.env.STRIPE_KEY; const key='sk_test_NOTREAL'; const jwt='eyJabc.def.ghi';");
    expect(value.redacted).toBe(true); for (const secret of ['hidden', 'private', 'sk_test_NOTREAL', 'eyJabc.def.ghi', 'STRIPE_KEY']) expect(value.text).not.toContain(secret);
  });
  it.each(['path', 'file', 'digest', 'range', 'evidence', 'plan', 'overlap', 'semantic', 'human-review'])('rejects tampered candidate %s', async (kind) => {
    const { input, patch } = await setup(); const file = patch.files[0]!; const edit = file.edits[0]!;
    if (kind === 'path') file.path = '../../README.md';
    if (kind === 'file') file.path = 'src/auth.ts';
    if (kind === 'digest') file.originalDigest = '0'.repeat(64);
    if (kind === 'range') edit.start = 0;
    if (kind === 'evidence') edit.evidenceIds = ['invented'];
    if (kind === 'plan') patch.planReferences = ['0'.repeat(64)];
    if (kind === 'overlap') file.edits.push(structuredClone(edit));
    if (kind === 'semantic') edit.replacement = 'discounts: [{ coupon: attacker }]';
    const raw = kind === 'human-review' ? { ...patch, requiresHumanReview: false } : patch;
    expect(validateCandidate(raw, input).status).toBe('PATCH_REJECTED');
  });
  it('applies a valid candidate with real diff, digests, syntax and unchanged originals', async () => {
    const { workspace, input, patch } = await setup(); const before = await readFile(path.join(fixture, 'src/billing.ts'), 'utf8');
    const result = await applyCandidate(workspace, input, patch);
    expect(CandidatePatchSchema.safeParse(result).success).toBe(true); expect(result.status).toBe('PATCH_READY_FOR_VALIDATION');
    expect(result.files[0]!.unifiedDiff).toContain('+client.subscriptions.create({ discounts:');
    expect(result.files[0]!.patchedDigest).not.toBe(result.files[0]!.originalDigest);
    expect(await readFile(path.join(fixture, 'src/billing.ts'), 'utf8')).toBe(before);
    expect(result.validation.find((v) => v.stage === 'syntax')?.passed).toBe(true);
    expect((await applyCandidate(workspace, input, patch)).status).toBe('PATCH_REJECTED');
  });
  it('parses TS and TSX without running code and rejects malformed syntax', () => {
    expect(syntaxValid('src/a.ts', "throw new Error('must never run');")).toBe(true);
    expect(syntaxValid('src/a.tsx', 'const view = <div />;')).toBe(true);
    expect(syntaxValid('src/a.ts', 'const x = [{;')).toBe(false);
  });
  it('emits standard diff markers including missing terminal newline', () => {
    expect(unifiedDiff('src/a.ts', 'const a = 1;', 'const a = 2;')).toContain('\\ No newline at end of file');
    expect(unifiedDiff('src/a.ts', 'same\n', 'same\n')).toBe('');
    expect(unifiedDiff('src/a.ts', "const password = 'hidden';\nconst a = 1;\n", "const password = 'hidden';\nconst a = 2;\n")).not.toContain('hidden');
  });
  it('keeps distant edits in separate hunks without rewriting the intervening source', () => {
    const before = 'const a = 1;\n' + '// unchanged\n'.repeat(100) + 'const b = 1;\n';
    const offsets = [before.indexOf('1'), before.lastIndexOf('1')];
    const edits = offsets.map((start, i) => ({ targetId: `t${i}`, operation: 'replace-range' as const, start, end: start + 1, expected: '1', replacement: '2', evidenceIds: ['e'] }));
    const after = before.replaceAll('= 1', '= 2'); const diff = editDiff('src/a.ts', before, after, edits);
    expect(diff.match(/^@@ /gm)).toHaveLength(2); expect(diff).not.toContain('-// unchanged'); expect(diff.length).toBeLessThan(400);
  });
});
