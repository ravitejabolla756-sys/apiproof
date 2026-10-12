import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_15: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'perplexity-gemini-3-1-flash-lite-preview-retired', providerId: 'perplexity',
    sourceUrl: 'https://docs.perplexity.ai/docs/resources/changelog', sourceType: 'official-changelog',
    documentFingerprint: 'e98cb1dfc959af15d65130bc1e21a8022d09d2dd761e3b4136a3091b1360af56', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Perplexity’s official API changelog and retained the July 2026 retirement of the preview Gemini model and its named stable replacement.',
    evidence: { providerId: 'perplexity', sourceUrl: 'https://docs.perplexity.ai/docs/resources/changelog', sourceTitle: 'Changelog', sourceLocator: 'section:Agent API Models, July 2026', claims: [
      { key: 'status', value: 'retired' }, { key: 'model', value: 'google/gemini-3.1-flash-lite-preview' },
      { key: 'behavior', value: 'requests return model not supported' }, { key: 'replacement', value: 'google/gemini-3.1-flash-lite' },
    ] },
    payload: { changeId: 'perplexity-gemini-3-1-flash-lite-preview-retired', title: 'Perplexity Gemini 3.1 Flash Lite preview model retirement', description: 'Perplexity documents that google/gemini-3.1-flash-lite-preview is retired and no longer supported by the API, and directs new requests to google/gemini-3.1-flash-lite. The candidate does not assert unrelated Perplexity models, SDK packages, or API behavior.', changeType: 'model_retired', applicabilityScope: { dimensions: ['provider', 'model'] }, affectedModels: ['google/gemini-3.1-flash-lite-preview'], replacement: { model: 'google/gemini-3.1-flash-lite' }, severity: 'high' },
  }),
];
