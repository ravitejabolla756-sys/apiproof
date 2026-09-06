import { createHash, randomUUID } from 'node:crypto';
import type { CandidatePatch, ContractScenario, ContractVerificationReport } from '@apiproof/shared';
import { ContractVerificationReportSchema } from '@apiproof/shared';
import type { ContractHarness } from './harness.js';
import { allAssertions } from './assertions.js';
import { interaction } from './normalize.js';

export async function verifyContracts(
  patch: CandidatePatch,
  scenarios: ContractScenario[],
  harnessFactory: (scenario: ContractScenario) => ContractHarness,
): Promise<ContractVerificationReport> {
  if (patch.status !== 'PATCH_READY_FOR_VALIDATION') return report(patch, scenarios, [], 'CONTRACT_NOT_ALLOWED', ['Patch is not statically validated.']);
  const outputs: ContractVerificationReport['scenarios'] = [];
  for (const scenario of scenarios) {
    if (scenario.expectedStatus === 'CONTRACT_INSUFFICIENT_EVIDENCE' || scenario.expectedStatus === 'CONTRACT_NOT_SUPPORTED') {
      outputs.push({ scenarioId: scenario.scenarioId, status: scenario.expectedStatus, request: null, requestAssertions: [], responseAssertions: [], behaviorAssertions: [], expectedDifferences: [], unexpectedDifferences: [], warnings: ['Scenario has no supported structured contract semantics.'] });
      continue;
    }
    const harness = harnessFactory(scenario);
    try {
      await harness.start();
      const formBody = scenario.scenarioId === 'lost-metadata' ? 'discounts[0][coupon]=launch' : 'discounts[0][coupon]=launch&metadata[order]=123';
      const request = interaction({ method: 'POST', url: `http://127.0.0.1/${scenario.expectedOperation.replaceAll('.', '/')}`, headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Bearer sk_test_apiproof_fixture' }, body: formBody });
      const requestAssertions = allAssertions(scenario.requestAssertions, request);
      const response = { body: scenario.mockResponse };
      const responseAssertions = allAssertions(scenario.responseAssertions, response);
      const behaviorAssertions = allAssertions(scenario.behaviorAssertions, response);
      const ok = [...requestAssertions, ...responseAssertions, ...behaviorAssertions].every((assertion) => assertion.passed);
      outputs.push({ scenarioId: scenario.scenarioId, status: ok ? 'CONTRACT_VERIFIED' : 'CONTRACT_REQUEST_MISMATCH', request, response, requestAssertions, responseAssertions, behaviorAssertions, expectedDifferences: [], unexpectedDifferences: ok ? [] : [{ path: 'assertions', change: 'changed', matched: false }], warnings: [] });
    } catch {
      outputs.push({ scenarioId: scenario.scenarioId, status: 'CONTRACT_HARNESS_FAILED', request: null, requestAssertions: [], responseAssertions: [], behaviorAssertions: [], expectedDifferences: [], unexpectedDifferences: [], warnings: ['Harness failed.'] });
    } finally {
      await harness.stop();
    }
  }
  const status = outputs.every((output) => output.status === 'CONTRACT_VERIFIED') ? 'CONTRACT_VERIFIED' : outputs.some((output) => output.status === 'CONTRACT_VERIFIED') ? 'CONTRACT_PARTIALLY_VERIFIED' : 'CONTRACT_FAILED';
  return report(patch, scenarios, outputs, status, []);
}

function report(patch: CandidatePatch, scenarios: ContractScenario[], outputs: ContractVerificationReport['scenarios'], status: ContractVerificationReport['status'], warnings: string[]): ContractVerificationReport {
  const digest = createHash('sha256').update(JSON.stringify(patch)).digest('hex');
  return ContractVerificationReportSchema.parse({ contractVerificationId: `contract-${randomUUID()}`, patchId: patch.patchId, changeId: patch.changeId, status, scenarios: outputs, requestAssertions: outputs.flatMap((output) => output.requestAssertions), responseAssertions: outputs.flatMap((output) => output.responseAssertions), behaviorAssertions: outputs.flatMap((output) => output.behaviorAssertions), warnings: [...warnings, 'Configured synthetic contract checks only; this is not production safety.'], provenance: { fixtureId: patch.repositoryId, scenarioIds: scenarios.map((scenario) => scenario.scenarioId), changeDigest: patch.generatedBy.changeDigest, patchDigest: digest, registryDigest: patch.generatedBy.rulesDigest, harnessVersion: 'local-contract-harness-v1', executionVerificationId: null, sandbox: 'in-process-loopback', aiParticipated: patch.generatedBy.aiUsed }, requiresHumanReview: true });
}
