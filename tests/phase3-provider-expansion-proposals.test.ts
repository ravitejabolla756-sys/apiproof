import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_PROVIDER_REGISTRY,
  EXPANSION_OFFICIAL_CHANGE_CANDIDATES,
  fingerprintCandidate,
} from '@apiproof/providers';
import {
  TypeScriptRepositoryAnalyzer,
  discoverProviders,
  evaluateNormalizedCompatibility,
  normalizeCompatibilityUsage,
  usageFindingToCompatibilityUsage,
} from '@apiproof/analyzers';
import { ReviewedCompatibilityChangeSchema, literalHash } from '@apiproof/shared';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const PROPOSAL_IDS = [
  'google-gemini-gemini-2-0-flash-shutdown-2026-06-01',
  'perplexity-gemini-3-1-flash-lite-preview-retired',
  'cohere-embed-v2-model-retirement-2026-04-04',
  'mistral-ocr-4-0-model-retirement-2026-09-30',
] as const;

const candidates = new Map(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.map((candidate) => [candidate.candidateId, candidate]));

/** Test-only projection: candidates remain needs_review and never enter production. */
function proposal(candidateId: (typeof PROPOSAL_IDS)[number]): ReviewedCompatibilityChange {
  const candidate = candidates.get(candidateId);
  if (!candidate) throw new Error(`MISSING_PHASE3_CANDIDATE:${candidateId}`);
  const payload = candidate.payload;
  return ReviewedCompatibilityChangeSchema.parse({
    providerId: candidate.providerId,
    changeId: payload.changeId ?? candidate.candidateId,
    title: payload.title,
    description: payload.description,
    changeType: payload.changeType,
    ...(payload.publishedAt ? { publishedAt: payload.publishedAt } : {}),
    ...(payload.effectiveAt ? { effectiveAt: payload.effectiveAt } : {}),
    ...(payload.removalAt ? { removalAt: payload.removalAt } : {}),
    officialSourceUrl: candidate.sourceUrl,
    sourceType: candidate.sourceType,
    applicabilityScope: payload.applicabilityScope,
    ...(payload.affectedPackages ? { affectedPackages: payload.affectedPackages } : {}),
    ...(payload.affectedVersionRange ? { affectedVersionRange: payload.affectedVersionRange } : {}),
    apiOperationPatterns: payload.apiOperationPatterns ?? [],
    affectedParameters: payload.affectedParameters ?? [],
    ...(payload.parameterConditions ? { parameterConditions: payload.parameterConditions } : {}),
    affectedResponseFields: payload.affectedResponseFields ?? [],
    affectedEndpoints: payload.affectedEndpoints ?? [],
    ...(payload.affectedDomains ? { affectedDomains: payload.affectedDomains } : {}),
    affectedModels: payload.affectedModels ?? [],
    affectedResources: payload.affectedResources ?? [],
    authOrHeaderPatterns: payload.authOrHeaderPatterns ?? [],
    ...(payload.enumMetadata ? { enumMetadata: payload.enumMetadata } : {}),
    ...(payload.apiVersionMetadata ? { apiVersionMetadata: payload.apiVersionMetadata } : {}),
    ...(payload.replacement ? { replacement: payload.replacement } : {}),
    severity: payload.severity ?? 'high',
    review: {
      status: 'reviewed',
      reviewer: 'phase3-test-only',
      reviewedAt: '2026-10-13',
      provenance: 'official',
      documentFingerprint: candidate.documentFingerprint,
      evidenceFingerprint: candidate.evidenceFingerprint,
      candidateFingerprint: fingerprintCandidate(candidate),
    },
    evidence: [{ url: candidate.sourceUrl, summary: 'Test-only projection; not a production review.', accessedAt: '2026-10-13' }],
  });
}

const fixtures = {
  'google-gemini-gemini-2-0-flash-shutdown-2026-06-01': {
    providerId: 'google-gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/generateContent',
  },
  'perplexity-gemini-3-1-flash-lite-preview-retired': {
    providerId: 'perplexity',
    endpoint: 'https://api.perplexity.ai/chat/completions',
  },
  'cohere-embed-v2-model-retirement-2026-04-04': {
    providerId: 'cohere',
    endpoint: 'https://api.cohere.com/v2/embed',
  },
  'mistral-ocr-4-0-model-retirement-2026-09-30': {
    providerId: 'mistral',
    endpoint: 'https://api.mistral.ai/v1/ocr',
  },
} as const;

function sourceFor(endpoint: string, model: string): string {
  return `fetch(${JSON.stringify(endpoint)}, { method: 'POST', body: { model: ${JSON.stringify(model)} } });`;
}

function dynamicSourceFor(endpoint: string): string {
  return `const model = process.env.PROVIDER_MODEL;\nfetch(${JSON.stringify(endpoint)}, { method: 'POST', body: { model } });`;
}

function providerDescriptor(providerId: string) {
  const definition = DISCOVERY_PROVIDER_REGISTRY.definitions.find((item) => item.id === providerId);
  if (!definition) throw new Error(`MISSING_PROVIDER_DEFINITION:${providerId}`);
  return {
    id: definition.id,
    packageName: definition.packageIdentifiers[0] ?? definition.id,
    constructorExports: [],
    apiDomains: definition.apiDomains,
    environmentVariables: definition.environmentVariables,
  };
}

async function analyzeFixture(candidateId: (typeof PROPOSAL_IDS)[number], model: string, dynamic = false): Promise<CompatibilityUsage> {
  const fixture = fixtures[candidateId];
  const source = dynamic ? dynamicSourceFor(fixture.endpoint) : sourceFor(fixture.endpoint, model);
  const files = new Map([['src/client.ts', source]]);
  const discovery = discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY);
  expect(discovery.map((item) => item.providerId)).toContain(fixture.providerId);
  const descriptor = providerDescriptor(fixture.providerId);
  const scan = await new TypeScriptRepositoryAnalyzer().analyze(files, descriptor);
  expect(scan.providerUsed).toBe(true);
  const finding = scan.usages.find((usage) => usage.kind === 'resource');
  expect(finding).toBeDefined();
  const base = usageFindingToCompatibilityUsage(finding!, fixture.providerId);
  const modelProperty = finding!.arguments?.flatMap((argument) => argument.properties).find((property) => property.path === 'model');
  expect(modelProperty).toBeDefined();
  if (!dynamic) expect(modelProperty?.literalHash).toBe(literalHash(model));
  return { ...base, ...(dynamic ? {} : { model }) };
}

function evaluate(candidateId: (typeof PROPOSAL_IDS)[number], usage: CompatibilityUsage) {
  const change = proposal(candidateId);
  const normalized = normalizeCompatibilityUsage(usage, { language: 'typescript' });
  return evaluateNormalizedCompatibility({ providerId: usage.providerId, usageIR: [normalized], completeEvidence: true }, change, {
    compatibilityProviders: new Set([usage.providerId]),
    requireOfficialProvenance: true,
  });
}

describe('Phase 3 provider expansion proposals', () => {
  it('keeps all four selected candidates review-gated and outside the production registry', async () => {
    for (const candidateId of PROPOSAL_IDS) {
      const candidate = candidates.get(candidateId);
      expect(candidate?.state).toBe('needs_review');
      expect(candidate?.sourceEvidence?.claims.length ?? 0).toBeGreaterThan(0);
    }
  });

  it.each(PROPOSAL_IDS)('proves static affected and replacement behavior for %s', async (candidateId) => {
    const change = proposal(candidateId);
    const affectedModel = change.affectedModels[0];
    const replacementModel = change.replacement?.model;
    expect(affectedModel).toBeDefined();
    expect(replacementModel).toBeDefined();
    const affected = evaluate(candidateId, await analyzeFixture(candidateId, affectedModel!));
    const replacement = evaluate(candidateId, await analyzeFixture(candidateId, replacementModel!));
    expect(affected.status).toBe('AFFECTED');
    expect(affected.matchedModel).toBe(affectedModel);
    expect(replacement.status).toBe('NOT_AFFECTED');
  });

  it.each(PROPOSAL_IDS)('fails closed for dynamic model evidence in %s', async (candidateId) => {
    const result = evaluate(candidateId, await analyzeFixture(candidateId, 'ignored-dynamic-model', true));
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('INSUFFICIENT_STATIC_EVIDENCE');
  });

  it('preserves Python limitation honestly instead of inventing model evidence', async () => {
    const provider = providerDescriptor('cohere');
    const scan = await (await import('@apiproof/analyzers')).PythonRepositoryAnalyzer.prototype.analyze.call(
      new (await import('@apiproof/analyzers')).PythonRepositoryAnalyzer(),
      new Map([
        ['requirements.txt', 'cohere==5.0.0\n'],
        ['src/client.py', 'import requests\nrequests.post("https://api.cohere.com/v2/embed", json={"model": "embed-english-v2.0"})\n'],
      ]),
      provider,
    );
    expect(scan.provider).toBe('cohere');
    expect(scan.usages.some((usage) => usage.arguments?.some((argument) => argument.properties.some((property) => property.path === 'model')))).toBe(false);
    expect((scan.usageIR ?? []).some((usage) => usage.model !== undefined)).toBe(false);
  });
});
