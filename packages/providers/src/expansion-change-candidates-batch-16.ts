import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_16: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'mixpanel-headless-jql-sunset-0-2-0', providerId: 'mixpanel',
    sourceUrl: 'https://raw.githubusercontent.com/mixpanel/mixpanel-headless/main/CHANGELOG.md', sourceType: 'sdk-release',
    documentFingerprint: 'ce358aad890edb5d4cb53c76adf2d1137a7f9af057bb8e0e815f93c30d1cb192', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched the official Mixpanel headless SDK changelog and retained the 0.2.0 entry stating that JQL is sunset as a breaking change.',
    evidence: { providerId: 'mixpanel', sourceUrl: 'https://raw.githubusercontent.com/mixpanel/mixpanel-headless/main/CHANGELOG.md', sourceTitle: 'mixpanel-headless CHANGELOG', sourceLocator: 'section:0.2.0 — 2026-06-05', claims: [
      { key: 'release', value: '0.2.0' }, { key: 'publishedAt', value: '2026-06-05' },
      { key: 'status', value: 'JQL sunset (breaking)' }, { key: 'package', value: 'mixpanel-headless' },
      { key: 'operation', value: 'JQL' },
    ] },
    payload: { changeId: 'mixpanel-headless-jql-sunset-0-2-0', title: 'Mixpanel headless SDK JQL sunset', description: 'The official mixpanel-headless changelog states that version 0.2.0 sunsets JQL as a breaking change. This candidate is limited to the named package, version range, and JQL operation; it does not assert an undocumented replacement or unrelated Mixpanel API behavior.', changeType: 'method_removed', publishedAt: '2026-06-05', affectedPackages: ['mixpanel-headless'], affectedVersionRange: '>=0.2.0', apiOperationPatterns: ['JQL'], applicabilityScope: { dimensions: ['provider', 'package', 'package_version', 'operation'] }, severity: 'high' },
  }),
];
