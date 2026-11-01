import type { MigrationPlan, PlanningInput } from '@apiproof/shared';
import { validatePlan } from '../planning/validator.js';
import type { PatchWorkspace } from './workspace.js';
import { checkWorkspace } from './workspace.js';
import { allowedPatchPath, fail, redactPatchContext, sha256 } from './policy.js';
import { targetsFor, testAssertionTargetsFor, syntaxValid } from './transforms.js';
import { loadPatchRules } from './rules.js';
import type { AuthorizedTarget } from './transforms.js';
import { readFile } from 'node:fs/promises';
import { PatchRuleSchema, RegistryChangeSchema } from '@apiproof/shared';
import type { PatchRule } from '@apiproof/shared';
import { resolveBundledResource } from './workspace.js';

export interface PatchGenerationInput {
  plan: MigrationPlan; planDigest: string; changeDigest: string; rulesDigest: string;
  repositoryId: string; runId: string; workspace: string; sourceDigests: Record<string, string>;
  targets: AuthorizedTarget[]; snippets: { file: string; text: string; redacted: boolean }[];
  instructions: unknown; warnings: string[]; supported: boolean;
}
export interface DynamicPatchRuleOptions {
  /** A server-validated rule for an approved database change. */
  readonly rule: PatchRule;
}
const issuedContexts = new WeakMap<PatchGenerationInput, { workspace: PatchWorkspace; canonical: PatchGenerationInput }>();
export function verifiedPatchContext(input: PatchGenerationInput, workspace: PatchWorkspace): PatchGenerationInput {
  const issued = issuedContexts.get(input);
  if (!issued || issued.workspace !== workspace) fail('UNISSUED_PATCH_CONTEXT');
  return structuredClone(issued.canonical);
}
export async function buildPatchContext(workspace: PatchWorkspace, input: PlanningInput, plan: MigrationPlan, options?: DynamicPatchRuleOptions): Promise<PatchGenerationInput> {
  await checkWorkspace(workspace); validatePlan(plan, input);
  if (!/^[a-z0-9_-]+$/.test(input.change.id)) fail('UNTRUSTED_CHANGE');
  const rules = await loadPatchRules();
  let canonicalChange: PlanningInput['change'];
  let rule: PatchRule | undefined;
  if (options) {
    rule = PatchRuleSchema.parse(options.rule);
    if (rule.changeDigest !== sha256(JSON.stringify(input.change))) fail('STALE_TRANSFORMATION_RULE');
    canonicalChange = input.change;
  } else {
    const registryFile = await resolveBundledResource('registry', input.change.provider, `${input.change.id}.json`);
    const bundled = RegistryChangeSchema.parse(JSON.parse(await readFile(registryFile, 'utf8')));
    if (sha256(JSON.stringify(bundled)) !== sha256(JSON.stringify(input.change))) fail('UNTRUSTED_CHANGE');
    canonicalChange = bundled as unknown as PlanningInput['change'];
    rule = rules.rules[input.change.id];
    if (rule && rule.changeDigest !== sha256(JSON.stringify(bundled))) fail('STALE_TRANSFORMATION_RULE');
  }
  const expectedLocations = input.impacts.map((item) => ({ file: item.location.file, line: item.location.start.line, column: item.location.start.column, symbol: item.symbol }));
  if (JSON.stringify(plan.affectedLocations) !== JSON.stringify(expectedLocations) || JSON.stringify(plan.facts) !== JSON.stringify(input.facts) || JSON.stringify(plan.evidence) !== JSON.stringify(input.evidence)) fail('PLAN_FACT_MISMATCH');
  if (plan.repository !== workspace.directory || input.repository !== workspace.directory || plan.generatedBy.changeDigest !== sha256(JSON.stringify(canonicalChange)) || plan.generatedBy.analysisDigest !== input.analysisDigest) fail('PLAN_PROVENANCE_MISMATCH');
  const targets: AuthorizedTarget[] = []; const snippets: PatchGenerationInput['snippets'] = []; const warnings: string[] = [];
  let supported = plan.status !== 'PLAN_INSUFFICIENT_EVIDENCE' && !['PLAN_GENERATION_FAILED', 'PLAN_UNSUPPORTED_PATTERN'].includes(plan.status);
  for (const file of new Set(plan.affectedLocations.map((item) => item.file))) {
    if (!allowedPatchPath(file)) { supported = false; continue; }
    const source = workspace.snapshot[file]; if (source === undefined || !syntaxValid(file, source)) { supported = false; continue; }
    const fileTargets = targetsFor(file, source, input, sha256(source), rule?.transformation);
    for (const target of fileTargets) {
      // Secrets inside the actual edit cannot be safely round-tripped; refuse instead of restoring redacted values.
      if (redactPatchContext(target.expected).redacted) { supported = false; warnings.push('SECRET_CONTEXT_REDACTED: edit intersects secret-like material.'); continue; }
      const bounded = source.slice(Math.max(0, target.start - 300), Math.min(source.length, target.end + 300));
      const redacted = redactPatchContext(bounded);
      if (redacted.redacted) warnings.push('SECRET_CONTEXT_REDACTED: surrounding context was redacted.');
      snippets.push({ file, ...redacted }); targets.push(target);
    }
  }
  const sourceTargets = [...targets];
  for (const file of Object.keys(workspace.snapshot).sort()) {
    if (sourceTargets.some((target) => target.path === file)) continue;
    const source = workspace.snapshot[file]!;
    for (const sourceTarget of sourceTargets) targets.push(...testAssertionTargetsFor(file, source, input, sourceTarget.path, sourceTarget));
  }
  // Every proven impact must have its own authorized transformation. No partial migration by omission.
  if (!targets.length || input.impacts.some((impact) => !targets.some((target) => target.evidenceIds.includes(`impact:${impact.usageId}`))) || JSON.stringify(snippets).length > 24_000 || targets.length > 50 || targets.some((target) => target.expected.length > 16_000 || target.replacement.length > 16_000)) supported = false;
  const cleanPlan = JSON.parse(JSON.stringify(plan, (_key, value: unknown) => typeof value === 'string' ? redactPatchContext(value).text : value)) as MigrationPlan;
  // Local absolute paths are not model context.
  cleanPlan.repository = workspace.repositoryId;
  if (JSON.stringify({ plan: cleanPlan, snippets, targets }).length > 64_000) { supported = false; warnings.push('CONTEXT_BOUND_REACHED'); }
  const sourceDigests = Object.fromEntries([...new Set(targets.map((target) => target.path))].filter((file) => workspace.snapshot[file] !== undefined).map((file) => [file, sha256(workspace.snapshot[file]!)]));
  const effectiveRulesDigest = sha256(JSON.stringify(options ? { ...rules, rules: { ...rules.rules, [input.change.id]: rule } } : rules));
  const result: PatchGenerationInput = { plan: cleanPlan, planDigest: sha256(JSON.stringify(plan)), changeDigest: sha256(JSON.stringify(canonicalChange)), rulesDigest: effectiveRulesDigest, repositoryId: workspace.repositoryId, runId: workspace.runId, workspace: workspace.directory, sourceDigests,
    targets: supported ? targets : [], snippets: supported ? snippets : [], instructions: rule?.transformation ?? null, warnings: [...new Set(warnings)], supported };
  issuedContexts.set(result, { workspace, canonical: structuredClone(result) });
  return result;
}
