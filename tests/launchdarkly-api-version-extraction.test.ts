import { describe, expect, it } from 'vitest';
import { PythonRepositoryAnalyzer, TypeScriptRepositoryAnalyzer, evaluateNormalizedCompatibility } from '@apiproof/analyzers';
import { DISCOVERY_PROVIDER_REGISTRY, EXPANSION_OFFICIAL_CHANGE_CANDIDATES, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { ReviewedCompatibilityChangeSchema } from '@apiproof/shared';
import type { NormalizedUsageIR } from '@apiproof/shared';
import type { ProviderDescriptor } from '@apiproof/core';

const provider: ProviderDescriptor = {
  id: 'launchdarkly',
  packageName: 'launchdarkly-node-server-sdk',
  constructorExports: [],
  apiDomains: ['launchdarkly.com', 'app.launchdarkly.com'],
  apiVersionHeaders: ['LD-API-Version'],
};

const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'launchdarkly-api-version-20220603-eol-2025-04-15')!;
const reviewedProjection = ReviewedCompatibilityChangeSchema.parse({
  providerId: candidate.providerId,
  changeId: candidate.payload.changeId,
  title: candidate.payload.title,
  description: candidate.payload.description,
  changeType: candidate.payload.changeType,
  removalAt: candidate.payload.removalAt,
  officialSourceUrl: candidate.sourceUrl,
  sourceType: candidate.sourceType,
  applicabilityScope: candidate.payload.applicabilityScope,
  apiOperationPatterns: [],
  affectedParameters: [],
  affectedResponseFields: [],
  affectedEndpoints: [],
  affectedModels: [],
  affectedResources: [],
  authOrHeaderPatterns: [],
  apiVersionMetadata: candidate.payload.apiVersionMetadata,
  severity: candidate.payload.severity,
  review: { status: 'reviewed', reviewer: 'test-only', reviewedAt: '2026-10-08', provenance: 'official' },
  evidence: [{ url: candidate.sourceUrl, summary: candidate.auditTrail[0]?.note ?? candidate.payload.description, accessedAt: '2026-10-08' }],
});

const policy = { compatibilityProviders: new Set(['launchdarkly']), requireOfficialProvenance: true };

function compatibility(scan: { usageIR?: readonly NormalizedUsageIR[] }) {
  return evaluateNormalizedCompatibility({ providerId: 'launchdarkly', usageIR: scan.usageIR ?? [], completeEvidence: true }, reviewedProjection, policy);
}

describe('generic API-version header extraction', () => {
  it('extracts an authoritative static TypeScript fetch header and evaluates the real LaunchDarkly candidate', async () => {
    const result = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20220603" } });',
    }, provider);
    const usage = result.usageIR?.find((item) => item.apiVersion === '20220603');
    expect(usage?.apiVersion).toBe('20220603');
    expect(usage?.dynamic).toBe(false);
    expect(usage?.headerEvidence).toEqual(expect.arrayContaining([{ name: 'LD-API-Version', value: '20220603', static: true, redacted: false, location: expect.any(Object) }]));
    expect(compatibility(result).status).toBe('AFFECTED');
    expect(compatibility(result).changeId).toBe('launchdarkly-api-version-20220603-eol-2025-04-15');
  });

  it('flows authoritative header metadata through indexed provider discovery without enabling compatibility', async () => {
    const { discoverProviders } = await import('@apiproof/analyzers');
    const discoveries = discoverProviders(new Map([
      ['src/client.ts', 'fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20220603" } });'],
    ]), DISCOVERY_PROVIDER_REGISTRY);
    expect(discoveries.find((item) => item.providerId === 'launchdarkly')?.apiVersionHeaders).toEqual(['LD-API-Version']);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('launchdarkly')).toHaveLength(1);
  });

  it('resolves a static header object variable and treats the replacement version as not affected', async () => {
    const result = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'const headers = { "LD-API-Version": "20240415" };\nfetch("https://api.launchdarkly.com/api/projects", { headers });',
    }, provider);
    expect(result.usageIR?.some((item) => item.apiVersion === '20240415' && !item.dynamic)).toBe(true);
    expect(compatibility(result).status).toBe('NOT_AFFECTED');
  });

  it('fails closed for dynamic, computed, duplicate-conflicting, missing, and non-authoritative headers', async () => {
    const dynamic = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'const version = process.env.LD_API_VERSION;\nfetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": version } });',
    }, provider);
    expect(compatibility(dynamic).status).toBe('NEEDS_REVIEW');
    expect(compatibility(dynamic).reasonCodes).toContain('API_VERSION_UNRESOLVED');

    const computed = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'const key = "LD-API-Version";\nfetch("https://api.launchdarkly.com/api/projects", { headers: { [key]: "20220603" } });',
    }, provider);
    expect(compatibility(computed).status).toBe('NEEDS_REVIEW');

    const duplicate = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20220603", "ld-api-version": "20240415" } });',
    }, provider);
    expect(compatibility(duplicate).status).toBe('NEEDS_REVIEW');

    const missing = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { Authorization: "Bearer do-not-persist" } });',
    }, provider);
    const missingHeader = missing.usageIR?.find((item) => item.endpoint?.includes('api.launchdarkly.com'));
    expect(compatibility(missing).status).toBe('NEEDS_REVIEW');
    expect(missingHeader?.headerEvidence?.find((item) => item.name === 'Authorization')).toMatchObject({ static: true, redacted: true });
    expect(JSON.stringify(missing)).not.toContain('do-not-persist');

    const wrongProvider = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.anthropic.com/v1/messages", { headers: { "LD-API-Version": "20220603" } });',
    }, provider);
    expect(wrongProvider.usageIR).toHaveLength(0);
  });

  it('extracts the equivalent static and dynamic Python requests evidence', async () => {
    const analyzer = new PythonRepositoryAnalyzer();
    const affected = await analyzer.analyze({ 'src/client.py': 'import requests\nrequests.get("https://api.launchdarkly.com/api/projects", headers={"LD-API-Version": "20220603"})\n' }, { ...provider, packageNames: ['requests'] });
    const replacement = await analyzer.analyze({ 'src/client.py': 'import requests\nrequests.get("https://api.launchdarkly.com/api/projects", headers={"LD-API-Version": "20240415"})\n' }, { ...provider, packageNames: ['requests'] });
    const dynamic = await analyzer.analyze({ 'src/client.py': 'import os\nimport requests\nversion = os.getenv("LD_API_VERSION")\nrequests.get("https://api.launchdarkly.com/api/projects", headers={"LD-API-Version": version})\n' }, { ...provider, packageNames: ['requests'] });
    expect(affected.usageIR?.some((item) => item.apiVersion === '20220603' && !item.dynamic)).toBe(true);
    expect(compatibility(affected).status).toBe('AFFECTED');
    expect(compatibility(replacement).status).toBe('NOT_AFFECTED');
    expect(compatibility(dynamic).status).toBe('NEEDS_REVIEW');
  });

  it('rejects malicious lookalike hosts and preserves candidate/registry boundaries', async () => {
    const result = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com.example.com/api", { headers: { "LD-API-Version": "20220603" } });\nfetch("https://evil.launchdarkly.com/api", { headers: { "LD-API-Version": "20220603" } });',
    }, provider);
    expect(result.usageIR).toHaveLength(1);
    expect(candidate.state).toBe('needs_review');
    expect(candidate.auditTrail.some((entry) => entry.state === 'reviewed')).toBe(false);
  });
});
