import { describe, expect, it } from 'vitest';
import { assessMigrationRule, type CompatibilityUsage } from '@apiproof/shared';
import { evaluateCompatibility } from '@apiproof/analyzers';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'u1', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions',
  evidenceKind: 'sdk', confidence: 0.98, static: true, location: { file: 'src/chat.ts', line: 12, column: 3, symbol: 'client.chat.completions.create' }, ...overrides,
});
const proof = (overrides: Partial<CompatibilityUsage> = {}) => evaluateCompatibility({ providerId: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', usages: [usage(overrides)], completeEvidence: true }, COMPATIBILITY_FIXTURES[0], { compatibilityProviders: new Set(['openai']) });
const rule = (overrides: Record<string, unknown> = {}) => ({
  ruleId: 'remove-functions', providerId: 'openai', changeId: 'fixture-openai-parameter', kind: 'parameter_removed', supportedLanguages: ['typescript'],
  preconditions: { requireStatus: 'AFFECTED', requireStaticUsage: true, requiredReasonCodes: ['VERSION_IN_AFFECTED_RANGE', 'MATCHED_STATIC_USAGE'] },
  authorizedTargets: [{ file: 'src/chat.ts', symbol: 'client.chat.completions.create', evidenceId: 'u1' }],
  transformation: { kind: 'remove-parameter', parameter: 'functions' }, expectedOldState: 'functions parameter is present', expectedNewState: 'functions parameter is absent',
  relatedTestStrategy: { required: true, description: 'Run the related billing/chat tests.', testFilePatterns: ['tests/**/*.test.ts'] },
  unsupportedConditions: ['computed property names', 'dynamic object spreads'], postconditions: ['changed call no longer contains functions'], requiresHumanReview: true, ...overrides,
});

describe('provider-neutral migration v2 contracts', () => {
  it('proves eligibility without generating a patch', () => {
    const assessment = assessMigrationRule(proof(), rule());
    expect(assessment.status).toBe('READY_FOR_DETERMINISTIC_MIGRATION');
    expect(assessment.authorizedTargets).toHaveLength(1);
    expect(assessment.transformation).toEqual({ kind: 'remove-parameter', parameter: 'functions' });
    expect(assessment.patchGenerated).toBe(false);
    expect(assessment.requiresHumanReview).toBe(true);
  });

  it('fails closed for dynamic or low-confidence evidence', () => {
    const assessment = assessMigrationRule(proof({ static: false, confidence: 0.4 }), rule());
    expect(assessment.status).toBe('NEEDS_REVIEW');
    expect(assessment.transformation).toBeNull();
    expect(assessment.reasons).toContain('COMPATIBILITY_NOT_AFFECTED');
    expect(assessment.reasons).toContain('DYNAMIC_OR_LOW_CONFIDENCE_USAGE');
  });

  it('rejects provider/change mismatches and unproven authorized targets', () => {
    expect(assessMigrationRule(proof(), rule({ providerId: 'anthropic' })).status).toBe('REJECTED');
    const missingEvidence = assessMigrationRule(proof(), rule({ authorizedTargets: [{ file: 'src/chat.ts', evidenceId: 'other-usage' }] }));
    expect(missingEvidence.status).toBe('NEEDS_REVIEW');
    expect(missingEvidence.reasons).toContain('AUTHORIZED_TARGET_NOT_PROVEN');
  });

  it('supports the initial deterministic transformation vocabulary without executing it', () => {
    const kinds = ['parameter_removed', 'parameter_renamed', 'parameter_required', 'method_renamed', 'method_replaced', 'endpoint_replacement', 'model_replacement', 'response_field_rename'];
    expect(kinds).toHaveLength(8);
    expect(assessMigrationRule(proof(), rule({ kind: 'parameter_renamed', transformation: { kind: 'rename-parameter', from: 'functions', to: 'tools' } })).transformation).toEqual({ kind: 'rename-parameter', from: 'functions', to: 'tools' });
  });
});
