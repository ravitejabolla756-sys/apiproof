import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, PythonRepositoryAnalyzer, TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { NormalizedUsageIR } from '@apiproof/shared';

const CHANGE_ID = 'launchdarkly-api-version-20220603-eol-2025-04-15';
const provider = {
  id: 'launchdarkly',
  packageName: 'launchdarkly-node-server-sdk',
  constructorExports: [] as readonly string[],
  apiDomains: ['launchdarkly.com', 'app.launchdarkly.com'],
  apiVersionHeaders: ['LD-API-Version'],
};

function evaluate(usageIR: readonly NormalizedUsageIR[], completeEvidence = true) {
  return evaluateRegisteredNormalizedCompatibility({ providerId: 'launchdarkly', usageIR, completeEvidence }, PRODUCTION_COMPATIBILITY_REGISTRY)
    .find((result) => result.changeId === CHANGE_ID);
}

describe('LaunchDarkly API-version reviewed production rule', () => {
  it('is the thirteenth reviewed rule and the eighth reviewed provider', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.providerId))).toHaveLength(15);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('launchdarkly')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID)).toMatchObject({
      providerId: 'launchdarkly', changeType: 'api_version_retired', removalAt: '2025-04-15', severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'api_version'] },
      apiVersionMetadata: { version: '20220603', replacement: '20240415' },
      officialSourceUrl: 'https://launchdarkly.com/docs/api/',
      review: {
        status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', provenance: 'official',
        documentFingerprint: 'e7fc7da9aee943cb863b3f7dd995d452f8862a1373f0af3967cd3b3f23e55fda',
        evidenceFingerprint: 'ef593fa2ae35eac21cabdc1e418361b7cfd7ba58c33f705399d885554346257d',
        candidateFingerprint: '663aab621a5cfb1f53ec1b258499d41744f9c70308a1ee1b22c4a2e04108fdce',
      },
    });
  });

  it('matches only the reviewed static API version from TypeScript headers', async () => {
    const analyzer = new TypeScriptRepositoryAnalyzer();
    const affected = await analyzer.analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20220603" } });',
    }, provider);
    const replacement = await analyzer.analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20240415" } });',
    }, provider);
    const unrelated = await analyzer.analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20990101" } });',
    }, provider);
    const dynamic = await analyzer.analyze({
      'src/client.ts': 'const version = process.env.LD_API_VERSION; fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": version } });',
    }, provider);
    const missing = await analyzer.analyze({
      'src/client.ts': 'fetch("https://api.launchdarkly.com/api/projects", { headers: { Authorization: "Bearer never-persist-this" } });',
    }, provider);

    expect(evaluate(affected.usageIR ?? [])).toMatchObject({ status: 'AFFECTED', changeId: CHANGE_ID });
    expect(evaluate(replacement.usageIR ?? [])).toMatchObject({ status: 'NOT_AFFECTED', changeId: CHANGE_ID });
    expect(evaluate(unrelated.usageIR ?? [])).toMatchObject({ status: 'NOT_AFFECTED', changeId: CHANGE_ID });
    expect(evaluate(dynamic.usageIR ?? [], false)).toMatchObject({ status: 'NEEDS_REVIEW', changeId: CHANGE_ID, reasonCodes: expect.arrayContaining(['API_VERSION_UNRESOLVED']) });
    expect(evaluate(missing.usageIR ?? [])).toMatchObject({ status: 'NEEDS_REVIEW', changeId: CHANGE_ID, reasonCodes: expect.arrayContaining(['API_VERSION_UNRESOLVED']) });
    expect(JSON.stringify(missing)).not.toContain('never-persist-this');
  });

  it('keeps Python evidence equivalent and rejects cross-provider or duplicate evidence', async () => {
    const python = await new PythonRepositoryAnalyzer().analyze({
      'src/client.py': 'import requests\nrequests.get("https://api.launchdarkly.com/api/projects", headers={"LD-API-Version": "20220603"})\n',
    }, { ...provider, packageNames: ['requests'] });
    const dynamicPython = await new PythonRepositoryAnalyzer().analyze({
      'src/client.py': 'import os\nimport requests\nrequests.get("https://api.launchdarkly.com/api/projects", headers={"LD-API-Version": os.getenv("LD_API_VERSION")})\n',
    }, { ...provider, packageNames: ['requests'] });
    const usageIR = python.usageIR ?? [];
    expect(evaluate(usageIR)).toMatchObject({ status: 'AFFECTED', changeId: CHANGE_ID });
    expect(evaluate(dynamicPython.usageIR ?? [], false)).toMatchObject({ status: 'NEEDS_REVIEW', changeId: CHANGE_ID });
    expect(evaluate([...usageIR, ...usageIR])).toMatchObject({ status: 'AFFECTED', matchedUsages: expect.arrayContaining([expect.any(Object)]) });
    expect(evaluate([...usageIR, ...usageIR])?.matchedUsages).toHaveLength(1);

    const wrongProvider = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.anthropic.com/v1/messages", { headers: { "LD-API-Version": "20220603" } });',
    }, provider);
    expect(wrongProvider.usageIR).toHaveLength(0);
    const otherProviderUsage = usageIR.map((item) => ({ ...item, providerId: 'anthropic' }));
    expect(evaluateRegisteredNormalizedCompatibility({ providerId: 'anthropic', usageIR: otherProviderUsage, completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY)
      .some((result) => result.changeId === CHANGE_ID)).toBe(false);
  });
});
