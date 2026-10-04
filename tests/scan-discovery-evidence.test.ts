import { describe, expect, it } from 'vitest';
import { parseScanDiscoveryEvidence } from '../apps/web/src/lib/server/scan-compatibility-evidence.js';

const raw = (overrides: Record<string, unknown> = {}) => JSON.stringify({ discovery: { schemaVersion: 1, truncated: false, providers: [{
  providerId: 'openai', providerName: 'OpenAI', packageName: 'openai', declaredVersion: '^4.0.0', resolvedVersion: '4.2.0',
  versionSource: 'pnpm-lock', versionConfidence: 'exact', capability: 'versionAware', capabilities: ['discovery', 'versionAware'],
  category: 'ai', detectionKind: ['package', 'import'], files: ['package.json', 'src/ai.ts'], apiDomains: ['api.openai.com'],
  evidence: [{ detectionKind: 'import', file: 'src/ai.ts', line: 1, column: 1, identifier: 'openai' }], ...overrides,
}] } });

describe('persisted scan discovery evidence', () => {
  it('parses a bounded generic provider projection', () => {
    expect(parseScanDiscoveryEvidence(raw())?.providers[0]).toMatchObject({ providerId: 'openai', resolvedVersion: '4.2.0', evidenceCount: 1 });
  });

  it('rejects malformed or unsafe discovery envelopes', () => {
    expect(parseScanDiscoveryEvidence('{"discovery":{"schemaVersion":1,"truncated":false,"providers":[{}]}}')).toBeNull();
    expect(parseScanDiscoveryEvidence(raw({ evidence: Array.from({ length: 5_001 }, () => ({})) }))).toBeNull();
  });
});
