import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { CompatibilityUsage } from '@apiproof/shared';

type Case = { providerId: string; changeId: string; expected: 'AFFECTED' | 'NOT_AFFECTED' | 'NEEDS_REVIEW'; usage?: Partial<CompatibilityUsage> };
const base = (providerId: string, id: string): CompatibilityUsage => ({
  id, providerId, packageName: 'fixture-package', evidenceKind: 'sdk', confidence: 0.95, static: true,
  location: { file: 'src/integration.ts', line: 12, column: 1 },
});
const cases: Case[] = [
  { providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', expected: 'AFFECTED', usage: { model: 'gpt-4.5-preview' } },
  { providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', expected: 'NOT_AFFECTED', usage: { model: 'gpt-4.1' } },
  { providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', expected: 'NEEDS_REVIEW', usage: { model: 'MODEL_FROM_CONFIG', static: false } },
  { providerId: 'openai', changeId: 'openai-assistants-api-sunset-2026-08-26', expected: 'AFFECTED', usage: { resource: 'Assistants API' } },
  { providerId: 'openai', changeId: 'openai-assistants-api-sunset-2026-08-26', expected: 'NOT_AFFECTED', usage: { resource: 'Responses API' } },
  { providerId: 'openai', changeId: 'openai-assistants-api-sunset-2026-08-26', expected: 'NEEDS_REVIEW', usage: { resource: 'Assistants API', static: false } },
  { providerId: 'anthropic', changeId: 'anthropic-claude-opus-4-1-retirement-2026-08-05', expected: 'AFFECTED', usage: { model: 'claude-opus-4-1-20250805' } },
  { providerId: 'anthropic', changeId: 'anthropic-claude-opus-4-1-retirement-2026-08-05', expected: 'NOT_AFFECTED', usage: { model: 'claude-opus-4-8' } },
  { providerId: 'anthropic', changeId: 'anthropic-claude-opus-4-1-retirement-2026-08-05', expected: 'NEEDS_REVIEW', usage: { model: 'MODEL_FROM_CONFIG', static: false } },
  { providerId: 'anthropic', changeId: 'anthropic-opus-4-7-parameter-restrictions', expected: 'AFFECTED', usage: { model: 'claude-opus-4-7', parameter: 'temperature', parameterValueStatus: 'disallowed' } },
  { providerId: 'anthropic', changeId: 'anthropic-opus-4-7-parameter-restrictions', expected: 'NOT_AFFECTED', usage: { model: 'claude-opus-4-7', parameter: 'temperature', parameterValueStatus: 'allowed' } },
  { providerId: 'anthropic', changeId: 'anthropic-opus-4-7-parameter-restrictions', expected: 'NEEDS_REVIEW', usage: { model: 'claude-opus-4-7', parameter: 'temperature', parameterValueStatus: 'unknown' } },
  { providerId: 'github', changeId: 'github-organization-security-fields-removed-2026-04-21', expected: 'AFFECTED', usage: { resource: 'get an organization and update an organization REST API endpoints', responseField: 'advanced_security_enabled_for_new_repositories' } },
  { providerId: 'github', changeId: 'github-organization-security-fields-removed-2026-04-21', expected: 'NOT_AFFECTED', usage: { resource: 'get an organization and update an organization REST API endpoints', responseField: 'name' } },
  { providerId: 'github', changeId: 'github-organization-security-fields-removed-2026-04-21', expected: 'NEEDS_REVIEW', usage: { resource: 'get an organization and update an organization REST API endpoints', responseField: 'advanced_security_enabled_for_new_repositories', static: false } },
  { providerId: 'github', changeId: 'github-synchronous-sbom-endpoint-removal-2026-11-13', expected: 'AFFECTED', usage: { endpoint: '/OWNER/REPO/dependency-graph/sbom' } },
  { providerId: 'github', changeId: 'github-synchronous-sbom-endpoint-removal-2026-11-13', expected: 'NOT_AFFECTED', usage: { endpoint: '/OWNER/REPO/dependency-graph/sbom/generate-report' } },
  { providerId: 'github', changeId: 'github-synchronous-sbom-endpoint-removal-2026-11-13', expected: 'NEEDS_REVIEW', usage: { endpoint: '/dynamic/endpoint', static: false } },
  { providerId: 'twilio', changeId: 'twilio-regional-api-domain-removal-2026-04-28', expected: 'AFFECTED', usage: { domain: 'api.ie1.twilio.com' } },
  { providerId: 'twilio', changeId: 'twilio-regional-api-domain-removal-2026-04-28', expected: 'NOT_AFFECTED', usage: { domain: 'api.twilio.com' } },
  { providerId: 'twilio', changeId: 'twilio-regional-api-domain-removal-2026-04-28', expected: 'NEEDS_REVIEW', usage: { domain: 'DOMAIN_FROM_CONFIG', static: false } },
  { providerId: 'supabase', changeId: 'supabase-management-logs-all-removal-2026-09-23', expected: 'AFFECTED', usage: { endpoint: 'analytics/endpoints/logs.all' } },
  { providerId: 'supabase', changeId: 'supabase-management-logs-all-removal-2026-09-23', expected: 'NOT_AFFECTED', usage: { endpoint: 'analytics/endpoints/logs' } },
  { providerId: 'supabase', changeId: 'supabase-management-logs-all-removal-2026-09-23', expected: 'NEEDS_REVIEW', usage: { endpoint: 'ENDPOINT_FROM_CONFIG', static: false } },
  { providerId: 'supabase', changeId: 'supabase-openapi-anon-key-access-2026-03-11', expected: 'AFFECTED', usage: { endpoint: '/rest/v1/', authOrHeader: 'anon key' } },
  { providerId: 'supabase', changeId: 'supabase-openapi-anon-key-access-2026-03-11', expected: 'NOT_AFFECTED', usage: { endpoint: '/rest/v1/', authOrHeader: 'service-role key' } },
  { providerId: 'supabase', changeId: 'supabase-openapi-anon-key-access-2026-03-11', expected: 'NEEDS_REVIEW', usage: { endpoint: '/rest/v1/', authOrHeader: 'unknown', static: false } },
  { providerId: 'github', changeId: 'github-synchronous-sbom-endpoint-removal-2026-11-13', expected: 'NOT_AFFECTED', usage: { endpoint: '/repos/OWNER/REPO/issues' } },
  { providerId: 'twilio', changeId: 'twilio-regional-api-domain-removal-2026-04-28', expected: 'NOT_AFFECTED', usage: { domain: 'api.us1.twilio.com' } },
  { providerId: 'supabase', changeId: 'supabase-openapi-anon-key-access-2026-03-11', expected: 'NOT_AFFECTED', usage: { endpoint: '/graphql', authOrHeader: 'anon key' } },
];

describe('realistic reviewed production registry benchmark', () => {
  it('evaluates 30 repository-shaped cases against the actual production registry', () => {
    const outcomes = cases.map((scenario) => {
      const usage = normalizeCompatibilityUsage({ ...base(scenario.providerId, scenario.changeId), ...scenario.usage }, { language: 'typescript' });
      const result = evaluateRegisteredNormalizedCompatibility({ providerId: scenario.providerId, usageIR: [usage], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY).find((item) => item.changeId === scenario.changeId);
      expect(result, scenario.changeId).toBeDefined();
      expect(result?.status, scenario.changeId).toBe(scenario.expected);
      return result?.status;
    });
    expect(outcomes).toHaveLength(30);
  });
});
