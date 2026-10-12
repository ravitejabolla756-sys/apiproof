import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_13: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'together-python-sdk-v2-files-retrieve-content-removed-2025-12-12', providerId: 'together-ai',
    sourceUrl: 'https://www.together.ai/blog/together-python-sdk-2-0', sourceType: 'migration-guide',
    documentFingerprint: '4d36b4bb9006caed80c6993b44a49c82f30f5a8462beaf83ab7ada1b94fd1a56', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Together AI’s official Python SDK v2 announcement and retained the documented removal of client.files.retrieve_content and replacement with client.files.content.',
    evidence: { providerId: 'together-ai', sourceUrl: 'https://www.together.ai/blog/together-python-sdk-2-0', sourceTitle: 'Announcing Together Python SDK v2.0', sourceLocator: 'article:2025-12-12', claims: [
      { key: 'publishedAt', value: '2025-12-12' }, { key: 'package', value: 'together' }, { key: 'version', value: '2.0' },
      { key: 'status', value: 'v1 moves into maintenance and then deprecation' }, { key: 'removedOperation', value: 'client.files.retrieve_content' },
      { key: 'replacement', value: 'client.files.content' },
    ] },
    payload: { changeId: 'together-python-sdk-v2-files-retrieve-content-removed-2025-12-12', title: 'Together Python SDK v2 files retrieval method removal', description: 'Together AI documents that Python SDK v2 removes client.files.retrieve_content and directs callers to client.files.content. The candidate is limited to the together package and v2 migration surface; it does not assert unrelated SDK methods or API behavior.', changeType: 'method_removed', publishedAt: '2025-12-12', affectedPackages: ['together'], affectedVersionRange: '>=2.0.0', apiOperationPatterns: ['client.files.retrieve_content'], applicabilityScope: { dimensions: ['provider', 'package', 'package_version', 'operation'] }, replacement: { operation: 'client.files.content' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'redis-cluster-slaves-renamed-redis-5-2020', providerId: 'redis',
    sourceUrl: 'https://redis.io/docs/latest/commands/cluster-slaves/', sourceType: 'official-documentation',
    documentFingerprint: 'cb0dbb6313b20d7f8ed57593fb9d8fc1e52a337db27643753c13500030ebe568', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Redis’ official CLUSTER SLAVES command documentation and retained its deprecation, compatibility note, and CLUSTER REPLICAS replacement.',
    evidence: { providerId: 'redis', sourceUrl: 'https://redis.io/docs/latest/commands/cluster-slaves/', sourceTitle: 'CLUSTER SLAVES Deprecated', sourceLocator: 'command:CLUSTER SLAVES', claims: [
      { key: 'resource', value: 'CLUSTER SLAVES' }, { key: 'status', value: 'deprecated as of Redis 5.0.0' },
      { key: 'replacement', value: 'CLUSTER REPLICAS' }, { key: 'compatibility', value: 'continues to work for backward compatibility' },
    ] },
    payload: { changeId: 'redis-cluster-slaves-renamed-redis-5-2020', title: 'Redis CLUSTER SLAVES command deprecation', description: 'Redis documents CLUSTER SLAVES as deprecated since Redis 5.0.0 and identifies CLUSTER REPLICAS as the replacement while retaining the old command for backward compatibility. No removal date is asserted.', changeType: 'method_renamed', applicabilityScope: { dimensions: ['provider', 'resource', 'operation'] }, affectedResources: ['CLUSTER SLAVES'], apiOperationPatterns: ['CLUSTER SLAVES'], replacement: { operation: 'CLUSTER REPLICAS' }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'redis-cloud-triggers-functions-preview-discontinued-2024-05', providerId: 'redis',
    sourceUrl: 'https://redis.io/docs/latest/operate/rc/changelog/2024/may-2024/', sourceType: 'official-changelog',
    documentFingerprint: '856e546243f4e7d5230aaa3d3842742bf58597b2ffa206a81c67f0c45bcd459c', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Redis Cloud’s official May 2024 changelog and retained the discontinuation of the Triggers and Functions preview and its affected commands.',
    evidence: { providerId: 'redis', sourceUrl: 'https://redis.io/docs/latest/operate/rc/changelog/2024/may-2024/', sourceTitle: 'Redis Cloud changelog (May 2024)', sourceLocator: 'section:End of Triggers and Functions preview', claims: [
      { key: 'publishedAt', value: '2024-05' }, { key: 'resource', value: 'Triggers and Functions preview' }, { key: 'status', value: 'discontinued' },
      { key: 'command', value: 'TFCALL' }, { key: 'command', value: 'TFCALLASYNC' }, { key: 'command', value: 'TFUNCTION' },
      { key: 'replacement', value: 'Lua functions and scripts remain unaffected' },
    ] },
    payload: { changeId: 'redis-cloud-triggers-functions-preview-discontinued-2024-05', title: 'Redis Cloud Triggers and Functions preview discontinuation', description: 'Redis Cloud documents that its Triggers and Functions preview was discontinued and that TFCALL, TFCALLASYNC, and TFUNCTION now return errors. The source states that Lua functions and scripts remain unaffected; no broader Redis command claim is made.', changeType: 'method_removed', publishedAt: '2024-05-01', applicabilityScope: { dimensions: ['provider', 'resource', 'operation'] }, affectedResources: ['Triggers and Functions preview'], apiOperationPatterns: ['TFCALL', 'TFCALLASYNC', 'TFUNCTION'], replacement: { resources: ['Lua functions and scripts'] }, severity: 'high' },
  }),
];
