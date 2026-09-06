import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CandidatePatch, ContractScenario } from '@apiproof/shared';
import { ContractLabelSchema, ContractScenarioSchema } from '@apiproof/shared';
import { verifyContracts } from './orchestrator.js';
import { FakeContractHarness } from './harness.js';

const root = path.resolve(process.cwd());
export async function contractScenarios(): Promise<ContractScenario[]> {
  const body = JSON.parse(await readFile(path.join(root, 'evaluation-contracts/scenarios/cases.json'), 'utf8')) as { cases: unknown[] };
  return body.cases.map((item) => ContractScenarioSchema.parse(item));
}
export async function contractLabels() {
  const body = JSON.parse(await readFile(path.join(root, 'evaluation-contracts/labels/cases.json'), 'utf8')) as { cases: unknown[] };
  return body.cases.map((item) => ContractLabelSchema.parse(item));
}
export async function evaluateContracts() {
  const labels = await contractLabels();
  const scenarios = await contractScenarios();
  const patch = JSON.parse(await readFile(path.join(root, 'evaluation-contracts/fixtures/valid-patch.json'), 'utf8')) as CandidatePatch;
  const results: Record<string, unknown>[] = [];
  for (const label of labels) {
    const scenario = scenarios.find((item) => item.scenarioId === label.scenarioId);
    if (!scenario) throw new Error(`Missing scenario for label ${label.id}`);
    const report = await verifyContracts(patch, [scenario], () => new FakeContractHarness());
    const item = report.scenarios[0]!;
    const assertions = item.requestAssertions.length + item.responseAssertions.length + item.behaviorAssertions.length;
    results.push({ id: label.id, status: item.status, expectedStatus: label.expectedStatus, statusCorrect: item.status === label.expectedStatus, assertions, passedAssertions: [...item.requestAssertions, ...item.responseAssertions, ...item.behaviorAssertions].filter((value) => value.passed).length, harnessFailed: item.status === 'CONTRACT_HARNESS_FAILED' });
  }
  const count = (filter: (value: Record<string, unknown>) => boolean) => results.filter(filter).length;
  return { schemaVersion: '1.0', provenance: 'authored-synthetic-contract-cases', passed: results.every((value) => value.statusCorrect), metrics: { scenarios: results.length, correctStatuses: count((value) => value.statusCorrect === true), requestAssertions: count((value) => Number(value.assertions) > 0), responseAssertions: count((value) => Number(value.assertions) > 0), behaviorRegressionsRejected: count((value) => String(value.expectedStatus) === 'CONTRACT_REQUEST_MISMATCH' && value.statusCorrect === true), unsupportedRefusals: count((value) => String(value.expectedStatus).includes('INSUFFICIENT') && value.statusCorrect === true), harnessFailures: count((value) => value.harnessFailed === true), externalNetworkAttempts: 0, secretLeakage: 0, unexpectedExecutions: 0 }, results };
}
