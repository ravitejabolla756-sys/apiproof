import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, PythonRepositoryAnalyzer, TypeScriptRepositoryAnalyzer, type PythonProviderDescriptor } from '@apiproof/analyzers';
import { DISCOVERY_PROVIDERS, EXPANSION_OFFICIAL_CHANGE_CANDIDATES, PRODUCTION_COMPATIBILITY_REGISTRY, promoteCandidateToReviewed } from '@apiproof/providers';
import { LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION, LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE, LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_REVIEW } from '../packages/providers/src/local-reviewed-candidate-reviews.js';
import type { NormalizedUsageIR } from '@apiproof/shared';

const CANDIDATE_ID = 'launchdarkly-api-version-20220603-eol-2025-04-15';
const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === CANDIDATE_ID)!;
const provider = {
  id: 'launchdarkly',
  packageName: 'launchdarkly-node-server-sdk',
  constructorExports: [] as readonly string[],
  apiDomains: ['launchdarkly.com', 'app.launchdarkly.com'],
  apiVersionHeaders: ['LD-API-Version'],
};
const pythonProvider: PythonProviderDescriptor = { ...provider, packageNames: ['requests'] };
const policy = { compatibilityProviders: new Set(['launchdarkly']), requireOfficialProvenance: true };

const reviewedRecord = promoteCandidateToReviewed(LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE, LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_REVIEW, [
  { url: candidate.sourceUrl, summary: candidate.auditTrail[0]?.note ?? candidate.payload.description, accessedAt: '2026-10-08' },
]);

function evaluate(usageIR: readonly NormalizedUsageIR[], completeEvidence = true) {
  return evaluateNormalizedCompatibility({ providerId: 'launchdarkly', usageIR, completeEvidence }, reviewedRecord, policy);
}

async function typescriptUsage(source: string) {
  const scan = await new TypeScriptRepositoryAnalyzer().analyze({ 'src/client.ts': source }, provider);
  return scan.usageIR ?? [];
}

describe('LaunchDarkly API-version human review', () => {
  it('records the explicit review on a separate copy and passes the promotion gate', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.auditTrail.some((entry) => entry.state === 'reviewed')).toBe(false);
    expect(LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE.state).toBe('reviewed');
    expect(LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE.auditTrail.at(-1)).toMatchObject({
      state: 'reviewed', actor: 'Ravi Teja', at: '2026-10-08', note: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.notes,
      reviewBinding: {
        documentFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.sourceFingerprint,
        evidenceFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.evidenceFingerprint,
        candidateFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.candidateFingerprint,
      },
    });
    expect(reviewedRecord).toMatchObject({
      providerId: 'launchdarkly',
      changeId: CANDIDATE_ID,
      removalAt: '2025-04-15',
      applicabilityScope: { dimensions: ['provider', 'api_version'] },
      apiVersionMetadata: { version: '20220603', replacement: '20240415' },
      severity: 'high',
      review: {
        status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', provenance: 'official',
        documentFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.sourceFingerprint,
        evidenceFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.evidenceFingerprint,
        candidateFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.candidateFingerprint,
      },
    });
    expect(reviewedRecord.affectedPackages).toBeUndefined();
    expect(reviewedRecord.apiOperationPatterns).toEqual([]);
    expect(reviewedRecord.affectedEndpoints).toEqual([]);
  });

  it('evaluates static, replacement, unrelated, and dynamic API-version evidence safely', async () => {
    const affected = await typescriptUsage('fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20220603" } });');
    const replacement = await typescriptUsage('fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20240415" } });');
    const unrelated = await typescriptUsage('fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20990101" } });');
    const dynamic = await typescriptUsage('const version = process.env.LD_API_VERSION; fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": version } });');

    expect(evaluate(affected)).toMatchObject({ status: 'AFFECTED', changeId: CANDIDATE_ID });
    expect(evaluate(replacement)).toMatchObject({ status: 'NOT_AFFECTED', changeId: CANDIDATE_ID });
    expect(evaluate(unrelated)).toMatchObject({ status: 'NOT_AFFECTED', changeId: CANDIDATE_ID });
    expect(evaluate(dynamic, false)).toMatchObject({ status: 'NEEDS_REVIEW', changeId: CANDIDATE_ID });
    expect(evaluate(dynamic, false).reasonCodes).toContain('API_VERSION_UNRESOLVED');
  });

  it('keeps cross-provider and duplicate-identity behavior isolated', async () => {
    const affected = await typescriptUsage('fetch("https://api.launchdarkly.com/api/projects", { headers: { "LD-API-Version": "20220603" } });');
    const duplicate = evaluate([...affected, ...affected]);
    expect(duplicate.status).toBe('AFFECTED');
    expect(duplicate.matchedUsages).toHaveLength(1);

    const wrongProvider = await new TypeScriptRepositoryAnalyzer().analyze({
      'src/client.ts': 'fetch("https://api.anthropic.com/v1/messages", { headers: { "LD-API-Version": "20220603" } });',
    }, provider);
    expect(wrongProvider.usageIR).toHaveLength(0);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('launchdarkly')).toHaveLength(1);
  });

  it('produces equivalent Python and TypeScript results without persisting secrets', async () => {
    const python = await new PythonRepositoryAnalyzer().analyze({
      'src/client.py': 'import requests\nrequests.get("https://api.launchdarkly.com/api/projects", headers={"LD-API-Version": "20220603"})\n',
    }, pythonProvider);
    expect(python.usageIR?.some((item) => item.apiVersion === '20220603' && !item.dynamic)).toBe(true);
    expect(evaluate(python.usageIR ?? [])).toMatchObject({ status: 'AFFECTED', changeId: CANDIDATE_ID });
    expect(JSON.stringify(python)).not.toMatch(/authorization|token|secret|api[-_]?key/i);
    expect(DISCOVERY_PROVIDERS.find((item) => item.id === 'launchdarkly')?.apiVersionHeaders).toEqual(['LD-API-Version']);
  });
});
