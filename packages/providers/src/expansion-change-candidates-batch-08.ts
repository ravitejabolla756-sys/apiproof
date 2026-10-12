import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_08: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'circleci-v1-trigger-rerun-api-removal-2027-02-01', providerId: 'circleci',
    sourceUrl: 'https://circleci.com/changelog/deprecation-of-v1-and-v1-1-trigger-and-rerun-apis-february-1-2027/', sourceType: 'official-changelog',
    documentFingerprint: '4cf20b30da99c918ade80e77815ccdf0c641780dc76d3042b2373d878fe92b3d', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched CircleCI’s official changelog entry and retained the ten listed v1/v1.1 trigger and rerun endpoints, the February 1, 2027 removal date, and the documented v2/v3 migration endpoints.',
    evidence: { providerId: 'circleci', sourceUrl: 'https://circleci.com/changelog/deprecation-of-v1-and-v1-1-trigger-and-rerun-apis-february-1-2027/', sourceTitle: 'Deprecation of v1 and v1.1 Trigger and Rerun APIs, February 1, 2027', sourceLocator: 'article:2026-10-07', claims: [
      { key: 'publishedAt', value: '2026-10-07' }, { key: 'removalAt', value: '2027-02-01' },
      { key: 'affectedEndpoints', value: '10 legacy v1 and v1.1 trigger and rerun endpoints' },
      { key: 'failure', value: 'HTTP 410 Gone after removal' }, { key: 'replacement', value: 'CircleCI API v2 and v3 trigger/rerun endpoints' },
    ] },
    payload: { changeId: 'circleci-v1-trigger-rerun-api-removal-2027-02-01', title: 'CircleCI v1 and v1.1 trigger/rerun API removal', description: 'CircleCI documents removal of ten legacy v1 and v1.1 trigger and rerun endpoints on February 1, 2027. The listed replacements are API v2 or v3 pipeline and workflow operations; no SDK package or version scope is asserted.', changeType: 'endpoint_removed', removalAt: '2027-02-01', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['POST /api/v1/project/:username/:repo/', 'POST /api/v1/project/:username/:repo/:build_num/retry', 'POST /api/v1/project/:username/:repo/:build_num/ssh', 'POST /api/v1/project/:username/:repo/build', 'POST /api/v1/project/:username/:repo/tree/:branch', 'POST /api/v1.1/project/:vcs-type/:username/:repo/', 'POST /api/v1.1/project/:vcs-type/:username/:repo/:build_num/retry', 'POST /api/v1.1/project/:vcs-type/:username/:repo/:build_num/ssh', 'POST /api/v1.1/project/:vcs-type/:username/:repo/build', 'POST /api/v1.1/project/:vcs-type/:username/:repo/tree/:branch'], replacement: { endpoint: 'CircleCI API v2 or v3 pipeline/workflow endpoints' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'intercom-run-assignment-rules-endpoint-removal-2026-12-31', providerId: 'intercom',
    sourceUrl: 'https://developers.intercom.com/docs/references/2.8/rest-api/api.intercom.io/conversations/autoassignconversation', sourceType: 'official-api-reference',
    documentFingerprint: '0bde5904dfb4612004df81c868be2bb6f9391cfdc9568bff2ede7701832f7dbd', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Intercom’s official API reference and retained the exact run-assignment-rules endpoint, version context, and December 31, 2026 removal date without inferring an undocumented replacement.',
    evidence: { providerId: 'intercom', sourceUrl: 'https://developers.intercom.com/docs/references/2.8/rest-api/api.intercom.io/conversations/autoassignconversation', sourceTitle: 'Run Assignment Rules on a conversation', sourceLocator: 'heading:Deprecation of Run Assignment Rules', claims: [
      { key: 'apiVersion', value: '2.12 and future versions' }, { key: 'removalAt', value: '2026-12-31' },
      { key: 'affectedEndpoint', value: 'POST /conversations/{id}/run_assignment_rules' }, { key: 'status', value: 'deprecated and permanently removed after the stated date' },
    ] },
    payload: { changeId: 'intercom-run-assignment-rules-endpoint-removal-2026-12-31', title: 'Intercom run assignment rules endpoint removal', description: 'Intercom documents that the run-assignment-rules conversation endpoint is deprecated in API version 2.12 and later and will be permanently removed on December 31, 2026. The candidate does not assert an SDK scope or an undocumented replacement.', changeType: 'endpoint_removed', removalAt: '2026-12-31', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['POST /conversations/{id}/run_assignment_rules'], severity: 'high' },
  }),
];
