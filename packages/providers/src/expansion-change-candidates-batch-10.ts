import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_10: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'plaid-public-key-auth-removal-api-2020-09-14', providerId: 'plaid',
    sourceUrl: 'https://plaid.com/docs/api/versioning/', sourceType: 'official-documentation',
    documentFingerprint: '4146449358a1f8db3324f38f034d4b7ffeaede466f2d0bea629330a74bfe1ffa', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Plaid’s official API versioning documentation and retained the version-specific removal of public_key authentication for the two documented institutions endpoints.',
    evidence: { providerId: 'plaid', sourceUrl: 'https://plaid.com/docs/api/versioning/', sourceTitle: 'API versioning', sourceLocator: 'section:Version 2020-09-14', claims: [
      { key: 'apiVersion', value: '2020-09-14' }, { key: 'affectedEndpoints', value: '/institutions/get_by_id; /institutions/search' },
      { key: 'removedAuthentication', value: 'public_key' }, { key: 'status', value: 'public_key fully removed from the API version' },
    ] },
    payload: { changeId: 'plaid-public-key-auth-removal-api-2020-09-14', title: 'Plaid public_key authentication removal', description: 'Plaid documents that API version 2020-09-14 fully removes public_key authentication from /institutions/get_by_id and /institutions/search, which require client_id and secret instead. The candidate does not assert other Plaid endpoints or SDK applicability.', changeType: 'parameter_removed', effectiveAt: '2020-09-14', applicabilityScope: { dimensions: ['provider', 'api_version', 'endpoint', 'parameter'] }, affectedEndpoints: ['/institutions/get_by_id', '/institutions/search'], affectedParameters: ['public_key'], apiVersionMetadata: { version: '2020-09-14', replacement: 'client_id and secret authentication' }, replacement: { parameter: 'client_id and secret' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'plaid-institutions-country-codes-required-api-2020-09-14', providerId: 'plaid',
    sourceUrl: 'https://plaid.com/docs/api/versioning/', sourceType: 'official-documentation',
    documentFingerprint: '4146449358a1f8db3324f38f034d4b7ffeaede466f2d0bea629330a74bfe1ffa', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Plaid’s official API versioning documentation and retained the version-specific country_codes requirement and top-level parameter move for the documented institutions endpoints.',
    evidence: { providerId: 'plaid', sourceUrl: 'https://plaid.com/docs/api/versioning/', sourceTitle: 'API versioning', sourceLocator: 'section:Version 2020-09-14', claims: [
      { key: 'apiVersion', value: '2020-09-14' }, { key: 'affectedEndpoints', value: '/institutions/get_by_id; /institutions/search' },
      { key: 'changedParameter', value: 'country_codes moved to top level and is required' }, { key: 'status', value: 'country_codes is required in the API version' },
    ] },
    payload: { changeId: 'plaid-institutions-country-codes-required-api-2020-09-14', title: 'Plaid institutions country_codes requirement', description: 'Plaid documents that API version 2020-09-14 requires country_codes for the institutions endpoints and moves it out of options to the top level. The candidate does not assert unrelated Plaid request or SDK behavior.', changeType: 'parameter_required', effectiveAt: '2020-09-14', applicabilityScope: { dimensions: ['provider', 'api_version', 'endpoint', 'parameter'] }, affectedEndpoints: ['/institutions/get_by_id', '/institutions/search'], affectedParameters: ['country_codes'], apiVersionMetadata: { version: '2020-09-14' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'postmark-bounces-tags-endpoint-deprecation-2019-12-02', providerId: 'postmark',
    sourceUrl: 'https://postmarkapp.com/updates/api-update-deprecating-bounces-tags', sourceType: 'deprecation-notice',
    documentFingerprint: '2085210af0bec50ef580292537f271e97e403b5b639e9ec41c477f9249cdc3df', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Postmark’s official API update and retained the /bounces/tags deprecation date and documented filtered /bounces replacement.',
    evidence: { providerId: 'postmark', sourceUrl: 'https://postmarkapp.com/updates/api-update-deprecating-bounces-tags', sourceTitle: 'API update: deprecating /bounces/tags', sourceLocator: 'section:API update: deprecating /bounces/tags', claims: [
      { key: 'affectedEndpoint', value: '/bounces/tags' }, { key: 'removalAt', value: '2019-12-02' },
      { key: 'replacement', value: '/bounces endpoint with filtering' }, { key: 'status', value: 'deprecated' },
    ] },
    payload: { changeId: 'postmark-bounces-tags-endpoint-deprecation-2019-12-02', title: 'Postmark bounces tags endpoint deprecation', description: 'Postmark documents deprecation of /bounces/tags on December 2, 2019 and directs integrations that need tag filtering to the /bounces endpoint with filtering.', changeType: 'endpoint_removed', removalAt: '2019-12-02', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['/bounces/tags'], replacement: { endpoint: '/bounces with filtering' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'replicate-cog-file-api-removal-new-runtime-2025-07-21', providerId: 'replicate',
    sourceUrl: 'https://replicate.com/changelog/2025-07-21-cog-runtime/', sourceType: 'official-changelog',
    documentFingerprint: '2ba3006b80338ea28b3011048464c546a2fff4216ecb8857b81658e491ccd37e', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Replicate’s official new Cog runtime changelog and retained the documented removal of the deprecated cog.File API and cog.Path replacement.',
    evidence: { providerId: 'replicate', sourceUrl: 'https://replicate.com/changelog/2025-07-21-cog-runtime/', sourceTitle: 'Introducing a new Cog runtime', sourceLocator: 'section:What do I need to change?', claims: [
      { key: 'affectedSymbol', value: 'cog.File' }, { key: 'replacement', value: 'cog.Path' },
      { key: 'runtime', value: 'new Cog runtime' }, { key: 'status', value: 'deprecated cog.File API removed' },
    ] },
    payload: { changeId: 'replicate-cog-file-api-removal-new-runtime-2025-07-21', title: 'Replicate Cog File API removal', description: 'Replicate documents that the new Cog runtime removes the deprecated cog.File API and directs model authors to use cog.Path. This candidate is limited to the documented Cog model source symbol and does not assert Replicate client SDK behavior.', changeType: 'endpoint_removed', effectiveAt: '2025-07-21', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['cog.File'], replacement: { resources: ['cog.Path'] }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'woocommerce-legacy-rest-api-core-removal-9-0', providerId: 'woocommerce',
    sourceUrl: 'https://developer.woocommerce.com/2023/10/03/the-legacy-rest-api-will-move-to-a-dedicated-extension-in-woocommerce-9-0/', sourceType: 'official-advisory',
    documentFingerprint: 'dbc0114d59f8663ed01ce088f760957b3bd5817c02843278faafc7e1d3c1a356', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched WooCommerce’s official advisory and retained the Legacy REST API core removal and dedicated extension migration path without broadening to current REST API versions.',
    evidence: { providerId: 'woocommerce', sourceUrl: 'https://developer.woocommerce.com/2023/10/03/the-legacy-rest-api-will-move-to-a-dedicated-extension-in-woocommerce-9-0/', sourceTitle: 'The Legacy REST API will move to a dedicated extension in WooCommerce 9.0', sourceLocator: 'section:The details', claims: [
      { key: 'affectedResource', value: 'WooCommerce Legacy REST API' }, { key: 'affectedWebhooks', value: 'legacy webhooks require the extension' },
      { key: 'removalAt', value: 'June 2024 with WooCommerce 9.0' }, { key: 'replacement', value: 'dedicated Legacy REST API extension' },
      { key: 'status', value: 'Legacy REST API deprecated and removed from WooCommerce core' },
    ] },
    payload: { changeId: 'woocommerce-legacy-rest-api-core-removal-9-0', title: 'WooCommerce Legacy REST API core removal', description: 'WooCommerce documents removal of the deprecated Legacy REST API from core in WooCommerce 9.0 and provides a dedicated extension for integrations that still depend on it, including legacy webhook payloads.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Legacy REST API', 'legacy webhooks'], replacement: { resources: ['dedicated Legacy REST API extension'] }, severity: 'high' },
  }),
];
