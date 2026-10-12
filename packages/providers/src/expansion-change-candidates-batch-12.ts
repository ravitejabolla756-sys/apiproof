import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_12: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'render-legacy-service-sharing-deprecated-2025-07-15', providerId: 'render',
    sourceUrl: 'https://render.com/changelog/deprecated-legacy-service-sharing', sourceType: 'official-changelog',
    documentFingerprint: 'f4325a92065c9f751ed6530310230c2d810da7a20a57657ea43336758a73ca03', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Render’s official legacy service sharing changelog and retained its deprecation, lack of a scheduled end-of-life date, and workspace-role replacement.',
    evidence: { providerId: 'render', sourceUrl: 'https://render.com/changelog/deprecated-legacy-service-sharing', sourceTitle: 'Deprecated: Legacy service sharing', sourceLocator: 'article:2025-07-15', claims: [
      { key: 'publishedAt', value: '2025-07-15' }, { key: 'resource', value: 'legacy service sharing' },
      { key: 'status', value: 'deprecated' }, { key: 'endOfLife', value: 'no scheduled date' },
      { key: 'replacement', value: 'add affected users to the workspace and assign appropriate roles' },
    ] },
    payload: { changeId: 'render-legacy-service-sharing-deprecated-2025-07-15', title: 'Render legacy service sharing deprecation', description: 'Render documents that legacy sharing of individual services with users outside a workspace is deprecated, with no scheduled end-of-life date, and directs users to add affected users to the workspace with appropriate roles. The candidate does not assert a shutdown date or unrelated Render access behavior.', changeType: 'endpoint_removed', publishedAt: '2025-07-15', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['legacy service sharing'], replacement: { resources: ['workspace membership and roles'] }, severity: 'medium' },
  }),
];
