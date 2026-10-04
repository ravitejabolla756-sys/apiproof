import { describe, expect, it } from 'vitest';
import { normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';

const base: CompatibilityUsage = {
  id: 'usage-1', providerId: 'openai', packageName: 'openai', operation: 'responses.create', model: 'gpt-4.1', parameter: 'input',
  evidenceKind: 'sdk', confidence: 0.96, static: true, location: { file: 'src/ai.ts', line: 42, column: 5, symbol: 'client.responses.create' },
};

describe('normalized usage IR', () => {
  it('normalizes SDK operations, versions, parameters, and source evidence', () => {
    const ir = normalizeCompatibilityUsage(base, { resolvedVersion: '4.2.0', versionSource: 'lockfile', versionConfidence: 'exact' });
    expect(ir).toMatchObject({ language: 'typescript', providerId: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', versionSource: 'lockfile', operation: 'responses.create', resource: 'responses', method: 'create', model: 'gpt-4.1', parameters: ['input'], dynamic: false, location: { file: 'src/ai.ts', line: 42 } });
    expect(ir.evidence[0]).toMatchObject({ kind: 'sdk-call', provenance: 'static-source', file: 'src/ai.ts', line: 42 });
  });

  it('preserves raw HTTP semantics and dynamic uncertainty without inventing SDK data', () => {
    const ir = normalizeCompatibilityUsage({ ...base, packageName: undefined, operation: undefined, endpoint: '/v1/responses', evidenceKind: 'http', static: false, confidence: 0.4, model: undefined, parameter: undefined }, { language: 'javascript', declaredVersion: '^4.0.0', versionConfidence: 'declared-only' });
    expect(ir).toMatchObject({ language: 'javascript', endpoint: '/v1/responses', operation: undefined, model: undefined, parameters: [], dynamic: true, confidence: 0.4, declaredVersion: '^4.0.0', versionConfidence: 'declared-only' });
    expect(ir.evidence[0]?.kind).toBe('http-call');
  });
});
