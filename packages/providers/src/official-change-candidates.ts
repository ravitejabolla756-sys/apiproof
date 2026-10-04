import type { CandidateChange } from '@apiproof/shared';
import { compileCandidateChangeRegistry } from './change-ingestion-registry.js';

/**
 * Read-only review queue populated from captured official sources. These
 * candidates are never compiled into the production compatibility registry.
 */
export const OFFICIAL_CHANGE_CANDIDATES: readonly CandidateChange[] = [
  {
    candidateId: 'openai-assistants-api-sunset-2026-08-26',
    providerId: 'openai',
    sourceUrl: 'https://developers.openai.com/api/docs/deprecations',
    sourceType: 'deprecation-notice',
    // SHA-256(canonical source URL + NUL + exact body), captured 2026-10-04.
    sourceFingerprint: '3a387018d47b0a201e3f4da10d302de14fd59d1eedd7c3da8ebed08819d09c77',
    discoveredAt: '2026-10-04',
    state: 'needs_review',
    payload: {
      changeId: 'openai-assistants-api-sunset-2026-08-26',
      title: 'OpenAI Assistants API sunset',
      description: 'OpenAI documents that the Assistants API was removed on 2026-08-26. The proposed beta.assistants SDK scope is an unreviewed MY OWL interpretation and requires human verification before promotion.',
      changeType: 'endpoint_removed',
      removalAt: '2026-08-26',
      affectedPackages: ['openai'],
      apiOperationPatterns: ['beta.assistants'],
      severity: 'high',
    },
    auditTrail: [
      { state: 'discovered', at: '2026-10-04', actor: 'official-source-capture', note: 'Captured the official OpenAI deprecations page and its exact-content fingerprint.' },
      { state: 'normalized', at: '2026-10-04', actor: 'candidate-normalizer', note: 'Normalized the documented API removal without inferring an SDK version range.' },
      { state: 'needs_review', at: '2026-10-04', actor: 'candidate-normalizer', note: 'Human review must verify the proposed Node SDK operation scope before promotion.' },
    ],
  },
];

export const OFFICIAL_CHANGE_CANDIDATE_REGISTRY = compileCandidateChangeRegistry(OFFICIAL_CHANGE_CANDIDATES);
