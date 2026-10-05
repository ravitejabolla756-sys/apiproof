import { describe, expect, it } from 'vitest';
import type { ReviewedCompatibilityChange } from '@apiproof/shared';
import { compileProductionChangeRegistry, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { evaluateRegisteredCompatibility } from '@apiproof/analyzers';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const officialRecord = (overrides: Partial<ReviewedCompatibilityChange> = {}): ReviewedCompatibilityChange => ({
  ...COMPATIBILITY_FIXTURES[0],
  review: { ...COMPATIBILITY_FIXTURES[0]!.review, status: 'reviewed', provenance: 'official' },
  evidence: [{ ...COMPATIBILITY_FIXTURES[0]!.evidence[0]!, url: COMPATIBILITY_FIXTURES[0]!.officialSourceUrl }],
  publishedAt: '2025-01-01', effectiveAt: '2025-02-01', removalAt: '2025-03-01',
  ...overrides,
});

describe('production reviewed change registry', () => {
  it('accepts reviewed official records and preserves source/date metadata', () => {
    const record = officialRecord();
    const registry = compileProductionChangeRegistry([record]);
    expect(registry.byChangeId.get(record.changeId)).toMatchObject({ publishedAt: '2025-01-01', effectiveAt: '2025-02-01', removalAt: '2025-03-01', officialSourceUrl: record.officialSourceUrl });
    expect(registry.byProvider.get('openai')).toHaveLength(1);
    expect(registry.byPackage.get('openai')).toHaveLength(1);
    expect(registry.byOperation.get('chat.completions.create')).toHaveLength(1);
  });

  it('rejects synthetic and draft records at the production boundary', () => {
    expect(() => compileProductionChangeRegistry([COMPATIBILITY_FIXTURES[0]])).toThrow('COMPATIBILITY_NON_OFFICIAL_RECORD');
    expect(() => compileProductionChangeRegistry([officialRecord({ review: { ...officialRecord().review, status: 'draft' } })])).toThrow('COMPATIBILITY_UNREVIEWED_RECORD');
  });

  it('rejects duplicate IDs, malformed ranges, unknown providers, and missing source evidence', () => {
    const record = officialRecord();
    expect(() => compileProductionChangeRegistry([record, { ...record, providerId: 'twilio' }])).toThrow('COMPATIBILITY_DUPLICATE_CHANGE_ID');
    expect(() => compileProductionChangeRegistry([{ ...record, changeId: 'bad-range', affectedVersionRange: 'not-a-range' }])).toThrow('COMPATIBILITY_INVALID_VERSION_RANGE');
    expect(() => compileProductionChangeRegistry([{ ...record, providerId: 'unknown-provider' }])).toThrow('COMPATIBILITY_UNKNOWN_PROVIDER');
    const missingSource = { ...record, evidence: [{ ...record.evidence[0]!, url: 'https://example.com/other' }] };
    expect(() => compileProductionChangeRegistry([missingSource])).toThrow('COMPATIBILITY_SOURCE_NOT_IN_EVIDENCE');
  });

  it('orders changes deterministically and supports multiple changes per provider', () => {
    const first = officialRecord({ changeId: 'change-b' });
    const second = officialRecord({ changeId: 'change-a', changeType: 'method_removed' });
    const registry = compileProductionChangeRegistry([first, second]);
    expect(registry.changes.map((change) => change.changeId)).toEqual(['change-a', 'change-b']);
    expect(registry.byProvider.get('openai')?.map((change) => change.changeId)).toEqual(['change-a', 'change-b']);
  });

  it('does not claim compatibility for discovery-only providers without reviewed changes', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(5);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')?.map((change) => change.changeId)).toEqual([
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
    ]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')?.map((change) => change.changeId)).toEqual([
      'anthropic-claude-opus-4-1-retirement-2026-08-05',
      'anthropic-opus-4-7-parameter-restrictions',
    ]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('github')?.map((change) => change.changeId)).toEqual([
      'github-organization-security-fields-removed-2026-04-21',
    ]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.has('cloudflare')).toBe(false);
  });

  it('evaluates only an exact registered production record', () => {
    const record = officialRecord({ changeId: 'registered-openai' });
    const registry = compileProductionChangeRegistry([record]);
    const result = evaluateRegisteredCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [{ id: 'u', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.99, static: true, location: { file: 'src/chat.ts', line: 10, column: 1 } }], completeEvidence: true }, registry, record.changeId);
    expect(result.status).toBe('AFFECTED');
    expect(() => evaluateRegisteredCompatibility({ providerId: 'openai', usages: [], completeEvidence: true }, registry, 'synthetic-openai')).toThrow('COMPATIBILITY_CHANGE_NOT_REGISTERED');
  });
});
