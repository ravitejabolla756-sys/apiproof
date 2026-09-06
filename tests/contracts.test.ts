import { describe, expect, it } from 'vitest';
import { CandidatePatchSchema } from '@apiproof/shared';
import { assertContract, contractScenarios, evaluateContracts, FakeContractHarness, LocalContractHarness, verifyContracts } from '@apiproof/core';
import { decodeForm, interaction } from '@apiproof/core';

const patch = CandidatePatchSchema.parse({ patchId: 'contract-test', changeId: 'stripe-subscription-coupon-removed', repositoryId: 'coupon-basic', status: 'PATCH_READY_FOR_VALIDATION', files: [], evidenceReferences: [], planReferences: ['0'.repeat(64)], warnings: [], validation: [], generatedBy: { implementation: 'test', version: '0.6.0', model: null, aiUsed: false, changeDigest: '0'.repeat(64), rulesDigest: '0'.repeat(64), planDigest: '0'.repeat(64), sourceDigests: {}, runId: 'run-test', workspace: 'C:\\YC' }, requiresHumanReview: true });

describe('contract verification', () => {
  it('normalizes nested form fields and redacts authorization', () => {
    expect(decodeForm('discounts[0][coupon]=launch&metadata[order]=123')).toEqual({ discounts: [{ coupon: 'launch' }], metadata: { order: '123' } });
    const value = interaction({ method: 'post', url: 'http://127.0.0.1/subscriptions/create', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Bearer secret' }, body: 'metadata[order]=123' });
    expect(value.headers).toEqual({ contentType: 'application/x-www-form-urlencoded', authorizationPresent: true, authorizationRedacted: true });
    expect(JSON.stringify(value)).not.toContain('secret');
  });

  it('captures loopback interactions without exposing credentials', async () => {
    const harness = new LocalContractHarness({ status: 201, body: { ok: true } });
    const base = await harness.start();
    const response = await fetch(`${base}/health`, { method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
    expect(response.status).toBe(201);
    expect(harness.interactions()[0]?.path).toBe('/health');
    expect(JSON.stringify(harness.interactions())).not.toContain('secret');
    await harness.stop();
  });

  it('verifies the full authored corpus with deterministic refusal labels', async () => {
    const result = await evaluateContracts();
    expect(result.passed).toBe(true);
    expect(result.metrics).toMatchObject({ scenarios: 24, correctStatuses: 24, behaviorRegressionsRejected: 6, unsupportedRefusals: 2, harnessFailures: 0, externalNetworkAttempts: 0, secretLeakage: 0 });
  });

  it('requires human review on reports and rejects nonvalidated patches', async () => {
    const scenarios = (await contractScenarios()).slice(0, 1);
    const report = await verifyContracts({ ...patch, status: 'PATCH_REJECTED' }, scenarios, () => new FakeContractHarness());
    expect(report.status).toBe('CONTRACT_NOT_ALLOWED');
    expect(report.requiresHumanReview).toBe(true);
  });

  it('supports negative assertions', () => {
    expect(assertContract({ assertion: 'FIELD_EQUALS_LITERAL', path: 'id', expected: 'expected' }, { id: 'actual' }).passed).toBe(false);
  });
});
