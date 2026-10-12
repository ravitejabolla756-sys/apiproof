import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_11: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'huggingface-hub-v2-deprecated-api-removals', providerId: 'hugging-face',
    sourceUrl: 'https://huggingface.co/docs/huggingface_hub/concepts/migration_v2', sourceType: 'migration-guide',
    documentFingerprint: '265960785887d32d4533398a220c575508512fa130c4d47738c515aa724831ec', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Hugging Face’s official huggingface_hub v2.0 migration guide and retained the documented removal of upload_large_folder and replacement with upload_folder.',
    evidence: { providerId: 'hugging-face', sourceUrl: 'https://huggingface.co/docs/huggingface_hub/concepts/migration_v2', sourceTitle: 'Migrating to huggingface_hub v2.0', sourceLocator: 'section:Removed APIs', claims: [
      { key: 'package', value: 'huggingface_hub' }, { key: 'version', value: '2.0' },
      { key: 'removedOperation', value: 'upload_large_folder' }, { key: 'replacement', value: 'upload_folder' },
      { key: 'status', value: 'deprecated 1.x APIs removed' },
    ] },
    payload: { changeId: 'huggingface-hub-v2-deprecated-api-removals', title: 'Hugging Face Hub v2 deprecated API removals', description: 'Hugging Face documents that deprecated huggingface_hub 1.x APIs are removed in v2.0, including upload_large_folder, and directs callers to upload_folder. The candidate does not assert an SDK method beyond the documented operation or any unrelated Hub API.', changeType: 'method_removed', affectedPackages: ['huggingface_hub'], affectedVersionRange: '>=2.0', apiOperationPatterns: ['upload_large_folder'], applicabilityScope: { dimensions: ['provider', 'package', 'package_version', 'operation'] }, replacement: { operation: 'upload_folder' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'planetscale-legacy-connection-string-brownout-2024-09-03', providerId: 'planetscale',
    sourceUrl: 'https://planetscale.com/changelog/legacy-password-deprecation', sourceType: 'official-changelog',
    documentFingerprint: 'b7c66274efa62f81e9b0930143493639906ee962bf9a8eca45810ce967e2fc59', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched PlanetScale’s official legacy connection string deprecation notice and retained the documented branch-ID host brownout and new infrastructure connection guidance.',
    evidence: { providerId: 'planetscale', sourceUrl: 'https://planetscale.com/changelog/legacy-password-deprecation', sourceTitle: 'Deprecation: legacy connection strings', sourceLocator: 'section:Legacy connection strings', claims: [
      { key: 'status', value: 'legacy connection strings deprecated' }, { key: 'legacyHost', value: 'branch ID host ending in psdb.cloud' },
      { key: 'newHost', value: 'aws.connect.psdb.cloud' }, { key: 'brownoutStart', value: '2024-09-03' },
      { key: 'replacement', value: 'new password and new hostname, username, and password' },
    ] },
    payload: { changeId: 'planetscale-legacy-connection-string-brownout-2024-09-03', title: 'PlanetScale legacy connection string brownout', description: 'PlanetScale documents brownouts for legacy branch-ID connection string hosts beginning September 3, 2024 and directs users to create a new password using the new infrastructure hostname. The source does not provide a final removal date and this candidate does not infer one.', changeType: 'endpoint_removed', effectiveAt: '2024-09-03', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['legacy connection strings'], replacement: { resources: ['new infrastructure connection string'] }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'planetscale-pscale-workflow-deprecation-2026-09-29', providerId: 'planetscale',
    sourceUrl: 'https://planetscale.com/changelog/move-tables-replaces-pscale-workflow', sourceType: 'official-changelog',
    documentFingerprint: 'e0bff4aeab13244175ad9224827922ca23c32ca6dfd4a2c365330ae8dad982a3', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched PlanetScale’s official move-tables changelog and retained the deprecation of pscale workflow commands and /workflows API endpoints.',
    evidence: { providerId: 'planetscale', sourceUrl: 'https://planetscale.com/changelog/move-tables-replaces-pscale-workflow', sourceTitle: 'New move-tables commands replace pscale workflow', sourceLocator: 'article:2026-09-29', claims: [
      { key: 'publishedAt', value: '2026-09-29' }, { key: 'deprecatedOperation', value: 'pscale workflow' },
      { key: 'deprecatedEndpoint', value: '/workflows API endpoints' }, { key: 'replacement', value: 'pscale branch vtctl move-tables' },
    ] },
    payload: { changeId: 'planetscale-pscale-workflow-deprecation-2026-09-29', title: 'PlanetScale pscale workflow deprecation', description: 'PlanetScale documents that pscale workflow commands and the /workflows API endpoints are deprecated and directs users to pscale branch vtctl move-tables. This candidate is limited to those documented commands and endpoints.', changeType: 'endpoint_removed', publishedAt: '2026-09-29', applicabilityScope: { dimensions: ['provider', 'endpoint', 'operation'] }, affectedEndpoints: ['/workflows API endpoints'], affectedResources: ['pscale workflow commands'], apiOperationPatterns: ['pscale workflow'], replacement: { resources: ['pscale branch vtctl move-tables'] }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'planetscale-cli-pre-0-182-commands-removed-2024-07-01', providerId: 'planetscale',
    sourceUrl: 'https://planetscale.com/changelog/deprecating-old-planetscale-cli-versions', sourceType: 'official-changelog',
    documentFingerprint: '737f8661a18d80eac6854f47942f498384ac71174dabc4b607b22471737c505c', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched PlanetScale’s official CLI deprecation notice and retained the version boundary and four documented commands that lose support.',
    evidence: { providerId: 'planetscale', sourceUrl: 'https://planetscale.com/changelog/deprecating-old-planetscale-cli-versions', sourceTitle: 'Deprecating old versions of the PlanetScale CLI', sourceLocator: 'section:What is changing', claims: [
      { key: 'publishedAt', value: '2024-06-17' }, { key: 'effectiveAt', value: '2024-07-01' },
      { key: 'version', value: 'older than v0.182.0' }, { key: 'operation', value: 'pscale connect' },
      { key: 'operation', value: 'pscale shell' }, { key: 'operation', value: 'pscale database dump' },
      { key: 'operation', value: 'pscale database restore-dump' },
    ] },
    payload: { changeId: 'planetscale-cli-pre-0-182-commands-removed-2024-07-01', title: 'PlanetScale CLI pre-v0.182 command support removal', description: 'PlanetScale documents that CLI versions older than v0.182.0 lose support on July 1, 2024 for pscale connect, pscale shell, pscale database dump, and pscale database restore-dump. The candidate does not infer behavior for other CLI commands or SDKs.', changeType: 'method_removed', effectiveAt: '2024-07-01', affectedPackages: ['pscale CLI'], affectedVersionRange: '<0.182.0', apiOperationPatterns: ['pscale connect', 'pscale shell', 'pscale database dump', 'pscale database restore-dump'], applicabilityScope: { dimensions: ['provider', 'package', 'package_version', 'operation'] }, replacement: { operation: 'PlanetScale CLI v0.182.0 or later' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'upstash-kafka-discontinuation-2025', providerId: 'upstash',
    sourceUrl: 'https://upstash.com/blog/workflow-kafka', sourceType: 'provider-announcement',
    documentFingerprint: 'f56c7fe7fefc9aacf3571140e3f7e53749fe467492a3124fbc6870ae95ae09d7', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Upstash’s official announcement and retained the Kafka discontinuation direction and migration products without inventing an exact shutdown date.',
    evidence: { providerId: 'upstash', sourceUrl: 'https://upstash.com/blog/workflow-kafka', sourceTitle: 'Announcing Upstash Workflow and Deprecating Upstash Kafka', sourceLocator: 'article:2024-09-06', claims: [
      { key: 'publishedAt', value: '2024-09-06' }, { key: 'resource', value: 'Upstash Kafka' },
      { key: 'status', value: 'support discontinued starting in six months' }, { key: 'replacement', value: 'Upstash Workflow and QStash' },
      { key: 'migrationWindow', value: 'six months' },
    ] },
    payload: { changeId: 'upstash-kafka-discontinuation-2025', title: 'Upstash Kafka discontinuation', description: 'Upstash announced that support for Upstash Kafka would be discontinued starting in six months and directed users toward Upstash Workflow and QStash. The announcement does not establish an exact shutdown date, so this remains a review-gated candidate without one.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Upstash Kafka'], replacement: { resources: ['Upstash Workflow', 'QStash'] }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'paddle-stored-payment-method-id-deprecated', providerId: 'paddle',
    sourceUrl: 'https://developer.paddle.com/changelog/2024/payment-method-paddle-id/', sourceType: 'official-changelog',
    documentFingerprint: '6419b13fd15453d98b1b3ba19175154e2dfda160b5954906a988fb04c255e2e4', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Paddle’s official payment method ID changelog and retained the deprecated response field and documented replacement.',
    evidence: { providerId: 'paddle', sourceUrl: 'https://developer.paddle.com/changelog/2024/payment-method-paddle-id/', sourceTitle: 'New payment method ID field for transaction payments', sourceLocator: 'section:Deprecated field', claims: [
      { key: 'apiVersion', value: '1' }, { key: 'resource', value: 'Transaction payment attempts' },
      { key: 'removedField', value: 'stored_payment_method_id' }, { key: 'replacementField', value: 'payment_method_id' },
      { key: 'status', value: 'deprecated' },
    ] },
    payload: { changeId: 'paddle-stored-payment-method-id-deprecated', title: 'Paddle stored payment method ID deprecation', description: 'Paddle documents stored_payment_method_id as deprecated for transaction payment attempts and identifies payment_method_id as the replacement. No removal date or SDK package scope is asserted.', changeType: 'response_field_removed', applicabilityScope: { dimensions: ['provider', 'resource', 'response_field'] }, affectedResources: ['Transaction payment attempts'], affectedResponseFields: ['payments[].stored_payment_method_id'], replacement: { resources: ['payments[].payment_method_id'] }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'paddle-balance-report-type-deprecated', providerId: 'paddle',
    sourceUrl: 'https://developer.paddle.com/changelog/2025/payout-reconciliation-report/', sourceType: 'official-changelog',
    documentFingerprint: '1c86b636287037854eb63570d2a4e9fb4f06375142b55613556b09f2c0f608e5', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Paddle’s official payout reconciliation changelog and retained the deprecated Report.type value and replacement value.',
    evidence: { providerId: 'paddle', sourceUrl: 'https://developer.paddle.com/changelog/2025/payout-reconciliation-report/', sourceTitle: 'Reconcile payouts with transactions and adjustments', sourceLocator: 'section:Report types', claims: [
      { key: 'apiVersion', value: '1' }, { key: 'resource', value: 'Report.type' },
      { key: 'deprecatedValue', value: 'balance' }, { key: 'replacementValue', value: 'payout_reconciliation' },
      { key: 'status', value: 'deprecated' },
    ] },
    payload: { changeId: 'paddle-balance-report-type-deprecated', title: 'Paddle balance report type deprecation', description: 'Paddle documents the balance report type as deprecated and identifies payout_reconciliation as the replacement for payout reconciliation reports. No removal date or unrelated report behavior is asserted.', changeType: 'enum_changed', applicabilityScope: { dimensions: ['provider', 'resource', 'enum'] }, affectedResources: ['Report.type'], enumMetadata: { name: 'Report.type', removedValues: ['balance'], addedValues: ['payout_reconciliation'] }, replacement: { resources: ['payout_reconciliation report'] }, severity: 'medium' },
  }),
];
