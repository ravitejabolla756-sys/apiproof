#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ApiProof, evaluateCorpus, evaluatePlanningCorpus, runFixturePatch, evaluatePatchCorpus, evaluateVerification, evaluateContracts, contractScenarios, verifyContracts, FakeContractHarness, verificationFixtures, verifyPatchedFixture, FakeSandbox, evaluateGithub, loadGitHubAppConfig } from '@apiproof/core';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { StripeProvider, loadStripeRegistry } from '@apiproof/providers';
import { AnalysisError, readJsonFile, TOOL_VERSION } from '@apiproof/shared';
import { formatImpact, formatScan } from './format.js';
import { formatEvaluation } from './evaluation-format.js';
import { formatPlan, formatPlanningEvaluation } from './plan-format.js';
import { formatPatch } from './patch-format.js';
import { formatVerification } from './verification-format.js';
import { formatContract } from './contract-format.js';

const toolRoot = fileURLToPath(new URL('../../../', import.meta.url));
const help = `APIProof Phase 7 — Stripe analysis, planning, contracts and review-gated GitHub proposals

Usage:
  apiproof scan <repository-path> [--json]
  apiproof impact <repository-path> --change <change.json> [--json]
  apiproof impact <repository-path> --change-id <registry-id> [--json]
  apiproof plan <repository-path> --change-id <registry-id> [--json]
  apiproof evaluate [--corpus <directory>] [--registry <directory>] [--json]
  apiproof evaluate-plans [--corpus <directory>] [--registry <directory>] [--json]
  apiproof patch <bundled-fixture-path> --change-id <registry-id> [--json]
  apiproof evaluate-patches [--json]
  apiproof evaluate-verification [--docker] [--json]
  apiproof evaluate-contracts [--json]
  apiproof verify-contract <registered-patch-run-id> [--json]
  apiproof verify-patch <registered-patch-run-id> [--json]
  apiproof evaluate-github [--json]
  apiproof github-smoke-test [--json]
  apiproof github-observe [--json]

Options:
  --json        Emit one JSON object (including errors)
  --change      Structured change fixture; required for impact
  --change-id   Reviewed registry record ID; alternative to --change
  --with-model  Reserved opt-in model path; unavailable unless a provider is configured
  --registry    Registry directory (default: bundled registry/stripe)
  --corpus      Evaluation directory (default: bundled evaluation)
  --help, -h    Show this help
  --version     Show tool version

Exit codes: 0 analysis completed (findings may exist); 1 analysis failed; 2 invalid input.
No customer code is executed, modified, merged, or deployed.`;

async function readChange(file: string): Promise<unknown> {
  try { return await readJsonFile(file); }
  catch { throw new AnalysisError('INVALID_CHANGE_FILE', 'Change must be a readable JSON file no larger than 256 KiB.'); }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let json = args.includes('--json');
  try {
    let parsed;
    try {
      parsed = parseArgs({ args, allowPositionals: true, strict: true,
        options: { json: { type: 'boolean' }, change: { type: 'string' }, 'change-id': { type: 'string' }, 'with-model': { type: 'boolean' },
          registry: { type: 'string' }, corpus: { type: 'string' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' } } });
    } catch { throw new AnalysisError('INVALID_ARGUMENTS', 'Invalid arguments. Run apiproof --help for usage.'); }
    json = parsed.values.json ?? false;
    if (parsed.values.help) { process.stdout.write(json ? `${JSON.stringify({ help })}\n` : `${help}\n`); return; }
    if (parsed.values.version) { process.stdout.write(`${json ? JSON.stringify({ version: TOOL_VERSION }) : TOOL_VERSION}\n`); return; }
    const [command, repository] = parsed.positionals;
    const proof = new ApiProof(new TypeScriptRepositoryAnalyzer(), new StripeProvider());
    const registryPath = parsed.values.registry ?? path.join(toolRoot, 'registry/stripe');
    if (command === 'evaluate-verification') {
      if (parsed.positionals.length !== 1 || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id']) throw new AnalysisError('INVALID_ARGUMENTS', 'Verification evaluation uses only --docker and --json.');
      if (parsed.values['with-model']) throw new AnalysisError('MODEL_UNAVAILABLE', 'Models cannot control verification.');
      const result = await evaluateVerification();
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : `Verification Evaluation\n${JSON.stringify(result.metrics, null, 2)}\nFakeSandbox: ${result.passed}\nDockerSandbox: NOT_EXECUTED\nNo production safety score.`}\n`);
      if (!result.passed) process.exitCode = 1; return;
    }
    if (command === 'evaluate-contracts') {
      if (parsed.positionals.length !== 1 || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id'] || parsed.values['with-model']) throw new AnalysisError('INVALID_ARGUMENTS', 'Contract evaluation uses only --json.');
      const result = await evaluateContracts(); process.stdout.write(`${json ? JSON.stringify(result, null, 2) : `Contract Evaluation\n${JSON.stringify(result.metrics, null, 2)}\nPassed: ${result.passed}\nNo production safety score.`}\n`); if (!result.passed) process.exitCode = 1; return;
    }
    if (command === 'evaluate-github') {
      if (parsed.positionals.length !== 1 || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id'] || parsed.values['with-model']) throw new AnalysisError('INVALID_ARGUMENTS', 'GitHub evaluation uses only --json.');
      const result = await evaluateGithub(); process.stdout.write(`${json ? JSON.stringify(result, null, 2) : `GitHub Evaluation\n${JSON.stringify(result.metrics, null, 2)}\nPassed: ${result.passed}`}` + '\n'); if (!result.passed) process.exitCode = 1; return;
    }
    if (command === 'github-smoke-test') {
      if (parsed.positionals.length !== 1 || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id'] || parsed.values['with-model']) throw new AnalysisError('INVALID_ARGUMENTS', 'GitHub smoke test uses only --json.');
      process.stdout.write(`${JSON.stringify({ status: 'LIVE_GITHUB_TEST_NOT_EXECUTED', reason: 'Explicit allowlisted credentials and repository configuration are unavailable.' })}\n`); return;
    }
    if (command === 'github-observe') {
      if (parsed.positionals.length !== 1 || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id'] || parsed.values['with-model']) throw new AnalysisError('INVALID_ARGUMENTS', 'GitHub observe uses only --json.');
      const config = loadGitHubAppConfig();
      if (!config.enabled) { process.stdout.write(`${JSON.stringify({ status: 'LIVE_GITHUB_OBSERVE_NOT_EXECUTED', mode: 'OBSERVE', repository: 'ravitejabolla756-sys/apiproof-github-fixture', reason: 'APIPROOF_ENABLE_LIVE_GITHUB is not true.' })}\n`); return; }
      process.stdout.write(`${JSON.stringify({ status: 'GITHUB_OBSERVE_CONFIGURED', mode: config.mode, repository: `${config.owner}/${config.repository}`, writes: 'BLOCKED' })}\n`); return;
    }
    if (command === 'verify-contract') {
      if (parsed.positionals.length !== 2 || !repository || !/^[0-9a-f-]{36}$/.test(repository) || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id'] || parsed.values['with-model']) throw new AnalysisError('CONTRACT_NOT_ALLOWED', 'Contract verification requires a registered UUID patch run.');
      const runRoot = path.join(toolRoot, '.tmp/patch-runs', repository); let raw;
      try { raw = await readJsonFile(path.join(runRoot, 'patch.json')); } catch { throw new AnalysisError('CONTRACT_NOT_ALLOWED', 'Patch run was not found in the controlled workspace.'); }
      const candidate = (await import('@apiproof/shared')).CandidatePatchSchema.parse(raw); const scenarios = (await contractScenarios()).filter((scenario) => scenario.fixtureId === candidate.repositoryId);
      if (!scenarios.length) throw new AnalysisError('CONTRACT_NOT_ALLOWED', 'Patch run is not tied to a registered contract scenario.');
      const report = await verifyContracts(candidate, scenarios, () => new FakeContractHarness()); process.stdout.write(`${json ? JSON.stringify(report, null, 2) : formatContract(report)}\n`); return;
    }
    if (command === 'verify-patch') {
      if (parsed.positionals.length !== 2 || !repository || !/^[0-9a-f-]{36}$/.test(repository) || parsed.values.corpus || parsed.values.registry || parsed.values.change || parsed.values['change-id']) throw new AnalysisError('VERIFICATION_NOT_ALLOWED', 'Verification requires a registered UUID patch run.');
      const runRoot = path.join(toolRoot, '.tmp/patch-runs', repository);
      if (path.resolve(runRoot) !== runRoot || path.relative(path.join(toolRoot, '.tmp/patch-runs'), runRoot).includes('..')) throw new AnalysisError('VERIFICATION_NOT_ALLOWED', 'Patch run is outside the controlled workspace.');
      let patch;
      try { patch = await readJsonFile(path.join(runRoot, 'patch.json')); } catch { throw new AnalysisError('VERIFICATION_NOT_ALLOWED', 'Patch run was not found in the controlled workspace.'); }
      const candidate = (await import('@apiproof/shared')).CandidatePatchSchema.parse(patch);
      const fixture = (await verificationFixtures()).find((item) => item.id === candidate.repositoryId);
      if (!fixture) throw new AnalysisError('VERIFICATION_NOT_ALLOWED', 'Patch run is not tied to a registered verification fixture.');
      const report = await verifyPatchedFixture(candidate, fixture, new FakeSandbox(), { workspace: candidate.generatedBy.workspace });
      process.stdout.write(`${json ? JSON.stringify(report, null, 2) : formatVerification(report)}\n`); return;
    }
    if (command === 'patch' || command === 'evaluate-patches') {
      if (parsed.values.registry || parsed.values.corpus || parsed.values.change || (command === 'patch' ? parsed.positionals.length !== 2 || !repository || !parsed.values['change-id'] : parsed.positionals.length !== 1 || !!parsed.values['change-id'])) throw new AnalysisError('INVALID_ARGUMENTS', 'Phase 4 uses only the bundled fixture corpus and reviewed registry.');
      if (parsed.values['with-model']) throw new AnalysisError('MODEL_UNAVAILABLE', 'No external patch model provider is configured.');
      const registry = await loadStripeRegistry(path.join(toolRoot, 'registry/stripe'));
      if (command === 'evaluate-patches') {
        const result = await evaluatePatchCorpus(registry, proof);
        process.stdout.write(`${json ? JSON.stringify(result, null, 2) : `Patch Evaluation\n${JSON.stringify(result.metrics, null, 2)}\nPassed: ${result.passed}\nAuthored fixtures only; no production safety score.`}\n`);
        if (!result.passed) process.exitCode = 1;
      } else {
        const change = registry.find((item) => item.id === parsed.values['change-id']);
        if (!change) throw new AnalysisError('INVALID_CHANGE_ID', 'Change ID was not found in the registry.');
        const { patch } = await runFixturePatch(repository!, change, proof);
        process.stdout.write(`${json ? JSON.stringify(patch, null, 2) : formatPatch(patch)}\n`);
        if (['PATCH_REJECTED', 'PATCH_APPLY_FAILED', 'PATCH_STATIC_VALIDATION_FAILED', 'PATCH_GENERATION_FAILED'].includes(patch.status)) process.exitCode = 1;
      }
      return;
    }
    if (command === 'evaluate') {
      if (parsed.positionals.length !== 1 || parsed.values.change || parsed.values['change-id']) throw new AnalysisError('INVALID_ARGUMENTS', 'Evaluate accepts only --corpus, --registry and --json.');
      const result = await evaluateCorpus(parsed.values.corpus ?? path.join(toolRoot, 'evaluation'), await loadStripeRegistry(registryPath), proof);
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : formatEvaluation(result)}\n`);
      if (result.failedCases) process.exitCode = 1;
      return;
    }
    if (command === 'evaluate-plans') {
      if (parsed.positionals.length !== 1 || parsed.values.change || parsed.values['change-id']) throw new AnalysisError('INVALID_ARGUMENTS', 'Evaluate-plans accepts only --corpus, --registry, --with-model and --json.');
      if (parsed.values['with-model']) throw new AnalysisError('MODEL_UNAVAILABLE', 'No external model provider is configured; deterministic planning evaluation remains available.');
      const result = await evaluatePlanningCorpus(parsed.values.corpus ?? path.join(toolRoot, 'evaluation-plans'), await loadStripeRegistry(registryPath), { plan: (repositoryPath, change) => proof.plan(repositoryPath, change) });
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : formatPlanningEvaluation(result)}\n`);
      if (result.planningFailures) process.exitCode = 1;
      return;
    }
    const changeId = parsed.values['change-id'];
    if (command === 'plan') {
      if (parsed.positionals.length !== 2 || !repository || !changeId || parsed.values.change || parsed.values.corpus) throw new AnalysisError('INVALID_ARGUMENTS', 'Use plan <path> --change-id <reviewed-record>.');
      if (parsed.values['with-model']) throw new AnalysisError('MODEL_UNAVAILABLE', 'No external model provider is configured; deterministic planning remains available.');
      const input = (await loadStripeRegistry(registryPath)).find((change) => change.id === changeId);
      if (!input) throw new AnalysisError('INVALID_CHANGE_ID', 'Change ID was not found in the registry.');
      const result = await proof.plan(repository, input);
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : formatPlan(result)}\n`);
      return;
    }
    if (parsed.positionals.length !== 2 || !repository || !['scan', 'impact'].includes(command ?? '') ||
        parsed.values.corpus || (command === 'scan' && (parsed.values.change || changeId || parsed.values.registry)) ||
        (command === 'impact' && Number(!!parsed.values.change) + Number(!!changeId) !== 1)) {
      throw new AnalysisError('INVALID_ARGUMENTS', 'Use scan <path> or impact <path> --change <file>. See --help.');
    }
    if (command === 'impact') {
      const input = changeId ? (await loadStripeRegistry(registryPath)).find((change) => change.id === changeId) : await readChange(parsed.values.change!);
      if (!input) throw new AnalysisError('INVALID_CHANGE_ID', 'Change ID was not found in the registry.');
      const result = await proof.impact(repository, input);
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : formatImpact(result)}\n`);
    } else {
      const result = await proof.scan(repository);
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : formatScan(result)}\n`);
    }
  } catch (error) {
    const known = error instanceof AnalysisError;
    const body = { error: { code: known ? error.code : 'ANALYSIS_FAILED',
      message: known ? error.message : 'Analysis failed. No customer code was executed or modified.' } };
    if (json) process.stdout.write(`${JSON.stringify(body)}\n`);
    else process.stderr.write(`APIProof error [${body.error.code}]: ${body.error.message}\n`);
    process.exitCode = known && /^(INVALID_|MISSING_|UNSUPPORTED_)/.test(error.code) ? 2 : 1;
  }
}

await main();
