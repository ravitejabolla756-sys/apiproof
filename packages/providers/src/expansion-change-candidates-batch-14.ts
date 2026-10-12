import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_14: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'railway-config-as-code-hard-cutoff-2026-12-01', providerId: 'railway',
    sourceUrl: 'https://docs.railway.com/config-as-code', sourceType: 'official-documentation',
    documentFingerprint: '3f978612ea295e4c4194eb3135e645bc6b219b38ca49d89efb93426b3a29676f', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Railway’s official Config as Code documentation and retained the deprecation, hard cutoff, and Infrastructure as Code replacement facts.',
    evidence: { providerId: 'railway', sourceUrl: 'https://docs.railway.com/config-as-code', sourceTitle: 'Using Config as Code', sourceLocator: 'section:Config as Code deprecation', claims: [
      { key: 'status', value: 'deprecated' }, { key: 'replacement', value: 'Infrastructure as Code (.railway/railway.ts)' },
      { key: 'legacyFiles', value: 'railway.json and railway.toml' }, { key: 'hardCutoff', value: '2026-12-01' },
      { key: 'newServices', value: 'cannot opt into Config as Code' },
    ] },
    payload: { changeId: 'railway-config-as-code-hard-cutoff-2026-12-01', title: 'Railway Config as Code hard cutoff', description: 'Railway documents Config as Code as deprecated and states that existing railway.json and railway.toml files continue to work only until the hard cutoff on December 1, 2026. Railway directs new configuration to Infrastructure as Code via .railway/railway.ts; the candidate does not assert unrelated Railway API or CLI behavior.', changeType: 'endpoint_removed', removalAt: '2026-12-01', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['railway.json', 'railway.toml Config as Code'], replacement: { resources: ['Infrastructure as Code (.railway/railway.ts)'] }, severity: 'high' },
  }),
];
