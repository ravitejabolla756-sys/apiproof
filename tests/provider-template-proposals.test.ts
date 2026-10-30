import { describe, expect, it } from 'vitest';
import { deriveReviewOnlyTemplateProposal, OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from '@apiproof/providers';

describe('review-only template proposals', () => {
  it('derives a literal model proposal without promoting it', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('groq-qwen-3-6-27b-retired-2026-09-14');
    expect(candidate).toBeDefined();
    const proposal = deriveReviewOnlyTemplateProposal(candidate!);
    expect(proposal).toMatchObject({ providerId: 'groq', transformation: { kind: 'model-literal-rename', from: 'qwen/qwen3.6-27b', to: 'qwen/qwen3.8-27b' } });
    expect(proposal?.limitation).toMatch(/^Review-only/);
  });

  it('keeps ambiguous or non-literal replacements manual-review only', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-assistants-api-sunset-2026-08-26');
    expect(candidate).toBeDefined();
    expect(deriveReviewOnlyTemplateProposal(candidate!)).toMatchObject({ mode: 'manual-guidance', providerId: 'openai' });
  });

  it('derives a narrow review-only import proposal for Firebase alias removal', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('firebase-vertexai-import-alias-removed-2025-07-17');
    expect(candidate).toBeDefined();
    expect(deriveReviewOnlyTemplateProposal(candidate!)).toMatchObject({ providerId: 'firebase', transformation: { kind: 'import-specifier-rename', from: 'firebase/vertexai', to: 'firebase/ai', preserveBindings: true } });
  });

  it('derives a bounded identifier proposal for Firebase symbol removals', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('firebase-vertexai-symbols-removed-2025-07-17');
    expect(candidate).toBeDefined();
    expect(deriveReviewOnlyTemplateProposal(candidate!)).toMatchObject({
      providerId: 'firebase',
      transformation: {
        kind: 'identifier-rename-many',
        replacements: [{ from: 'getVertexAI', to: 'getAI' }, { from: 'VertexAIError', to: 'AIError' }],
        preserveBindings: true,
      },
    });
  });

  it('derives an API-version proposal only for concrete version literals', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('shopify-api-2025-10-version-retired-2026-10-16');
    expect(candidate).toBeDefined();
    expect(deriveReviewOnlyTemplateProposal(candidate!)).toMatchObject({
      providerId: 'shopify',
      transformation: { kind: 'api-version-literal-rename', property: 'apiVersion', from: '2025-10', to: '2026-01', preserveArguments: true },
    });
  });

  it('keeps wildcard or range-like API versions out of literal fixes', () => {
    const aws = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('aws-javascript-sdk-v2-end-of-support-2025-09-08');
    const launchDarkly = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('launchdarkly-api-versions-retired-2026-12-31');
    expect(deriveReviewOnlyTemplateProposal(aws!)).toMatchObject({ mode: 'manual-guidance', providerId: 'aws' });
    expect(deriveReviewOnlyTemplateProposal(launchDarkly!)).toMatchObject({ mode: 'manual-guidance', providerId: 'launchdarkly' });
  });

  it('provides provider-specific manual playbooks for behavioral migrations', () => {
    for (const candidateId of [
      'google-cloud-api-registry-mcp-operations-removed-2026-07-30',
      'slack-files-upload-removal-2025-11-12',
      'auth0-connections-enabled-clients-deprecated-2026-01-21',
      'vercel-webhooks-rest-api-removed',
      'braintree-drop-in-sdk-deprecated-2026-10-01',
    ]) {
      const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(candidateId);
      const proposal = candidate && deriveReviewOnlyTemplateProposal(candidate);
      expect(proposal).toMatchObject({ mode: 'manual-guidance', templateId: expect.stringContaining('manual-review') });
      expect(proposal && proposal.mode === 'manual-guidance' ? proposal.guidance.steps.length : 0).toBeGreaterThan(1);
    }
  });

  it('keeps every currently semantic launch-provider migration review-only', () => {
    const semanticProviders = new Set(['auth0', 'aws', 'braintree', 'google-cloud', 'slack', 'stripe', 'vercel']);
    const candidates = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.filter((candidate) => semanticProviders.has(candidate.providerId));

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      const proposal = deriveReviewOnlyTemplateProposal(candidate);
      expect(proposal, candidate.candidateId).toBeDefined();
      expect(proposal?.mode, candidate.candidateId).toBe('manual-guidance');
      expect(proposal?.sourceUrl, candidate.candidateId).toBe(candidate.sourceUrl);
    }
  });

  it('gives every official candidate an explicit review artifact', () => {
    for (const candidate of OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates) {
      const proposal = deriveReviewOnlyTemplateProposal(candidate);
      expect(proposal, candidate.candidateId).toBeDefined();
      expect(proposal?.sourceUrl, candidate.candidateId).toBe(candidate.sourceUrl);
    }
  });
});
