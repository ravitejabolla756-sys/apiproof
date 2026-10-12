import type { CandidateChange } from '@apiproof/shared';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

export const EXPANSION_OFFICIAL_CHANGE_CANDIDATES_BATCH_09: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'mailgun-events-api-deprecation', providerId: 'mailgun',
    sourceUrl: 'https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/events/get-v3-domain_name-events', sourceType: 'official-api-reference',
    documentFingerprint: '46264b9a23faaf23d90009d201e2bf7fe2b09e10c8733834f902f26f193d6574', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Mailgun’s official API reference and retained the exact Events endpoint deprecation and documented Logs API replacement without asserting a removal date.',
    evidence: { providerId: 'mailgun', sourceUrl: 'https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/events/get-v3-domain_name-events', sourceTitle: 'Retrieves a paginated list of events', sourceLocator: 'warning:API is deprecated in favor of Logs API', claims: [
      { key: 'status', value: 'deprecated' }, { key: 'affectedEndpoint', value: 'GET /v3/{domain_name}/events' }, { key: 'replacement', value: 'Mailgun Logs API' },
    ] },
    payload: { changeId: 'mailgun-events-api-deprecation', title: 'Mailgun Events API deprecation', description: 'Mailgun marks the v3 Events endpoint as deprecated and directs integrations to the Logs API. No removal date or SDK scope is asserted.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['GET /v3/{domain_name}/events'], replacement: { endpoint: 'Mailgun Logs API' }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'sentry-project-issues-endpoint-deprecation', providerId: 'sentry',
    sourceUrl: 'https://docs.sentry.io/api/events/list-a-projects-issues/', sourceType: 'official-api-reference',
    documentFingerprint: 'ce0a93294879653a7a889bce33d8417759db18ce1cc80c36fa41c9da51ad52aa', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Sentry’s official API reference and retained the project-issues endpoint deprecation and Organization Issues replacement.',
    evidence: { providerId: 'sentry', sourceUrl: 'https://docs.sentry.io/api/events/list-a-projects-issues/', sourceTitle: "List a Project's Issues", sourceLocator: 'deprecation:replaced with Organization Issues endpoint', claims: [
      { key: 'status', value: 'deprecated' }, { key: 'affectedEndpoint', value: 'GET /api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/issues/' }, { key: 'replacement', value: 'Organization Issues endpoint' },
    ] },
    payload: { changeId: 'sentry-project-issues-endpoint-deprecation', title: 'Sentry project issues endpoint deprecation', description: 'Sentry documents that the project-scoped issues endpoint is deprecated and replaced by the Organization Issues endpoint. No removal date, SDK scope, or unrelated endpoint behavior is asserted.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['GET /api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/issues/'], replacement: { endpoint: 'Organization Issues endpoint' }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'paypal-invoicing-v1-reminder-endpoint-deprecation', providerId: 'paypal',
    sourceUrl: 'https://developer.paypal.com/api/deprecated/invoicing/v1/invoice-remind', sourceType: 'deprecation-notice',
    documentFingerprint: '7eb4487a66c831197bbcf504e87f8843425a7be7986063893fc12c3a73f2c507', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched PayPal’s official deprecated Invoicing v1 reference and retained the exact reminder endpoint and v2 invoicing replacement.',
    evidence: { providerId: 'paypal', sourceUrl: 'https://developer.paypal.com/api/deprecated/invoicing/v1/invoice-remind', sourceTitle: 'Send invoice reminder - Invoices v1 (Deprecated)', sourceLocator: 'deprecation notice:/v1/invoices', claims: [
      { key: 'status', value: 'deprecated' }, { key: 'affectedEndpoint', value: 'POST /v1/invoicing/invoices/{invoice_id}/remind' }, { key: 'replacement', value: '/v2/invoicing/invoices' },
    ] },
    payload: { changeId: 'paypal-invoicing-v1-reminder-endpoint-deprecation', title: 'PayPal Invoicing v1 reminder endpoint deprecation', description: 'PayPal documents the v1 Invoicing endpoint as deprecated and directs integrations to v2 Invoicing. The candidate is limited to the documented reminder operation and does not assert SDK or unrelated REST behavior.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['POST /v1/invoicing/invoices/{invoice_id}/remind'], replacement: { endpoint: '/v2/invoicing/invoices' }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'chargebee-item-entitlements-operation-deprecation', providerId: 'chargebee',
    sourceUrl: 'https://apidocs.chargebee.com/docs/api/item_entitlements/upsert-or-remove-item-entitlements-for-a-feature', sourceType: 'official-api-reference',
    documentFingerprint: '16e8e0b28c3777fdb985697d4277fb0a7be198dea7333799908ff6c34ce327c5', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Chargebee’s official API reference and retained the exact deprecated item-entitlements operation and Manage entitlements migration direction.',
    evidence: { providerId: 'chargebee', sourceUrl: 'https://apidocs.chargebee.com/docs/api/item_entitlements/upsert-or-remove-item-entitlements-for-a-feature', sourceTitle: 'Upsert or remove item entitlements for a feature', sourceLocator: 'deprecation:Migrate your integration to Manage entitlements', claims: [
      { key: 'status', value: 'deprecated and no longer maintained' }, { key: 'affectedOperation', value: 'upsert or remove item entitlements for a feature' }, { key: 'replacement', value: 'Manage entitlements' },
    ] },
    payload: { changeId: 'chargebee-item-entitlements-operation-deprecation', title: 'Chargebee item entitlements operation deprecation', description: 'Chargebee marks the item-entitlements upsert/remove operation as deprecated and directs integrations to Manage entitlements. The candidate does not assert an SDK package, version, or undocumented endpoint behavior.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'operation'] }, apiOperationPatterns: ['item_entitlements.upsert_or_remove'], replacement: { operation: 'Manage entitlements' }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'adyen-terminal-assign-terminals-v1-deprecation', providerId: 'adyen',
    sourceUrl: 'https://docs.adyen.com/api-explorer/postfmapi/latest/post/assignTerminals', sourceType: 'official-api-reference',
    documentFingerprint: 'e1c69e6be83caf6cdf70bf93d1c0dc6944403001f87c7496e31b7f31375131b6', discoveredAt: '2026-10-13',
    evidenceNote: 'Fetched Adyen’s official API Explorer page and retained the deprecated v1 assignTerminals endpoint, support end date, and documented reassign replacement.',
    evidence: { providerId: 'adyen', sourceUrl: 'https://docs.adyen.com/api-explorer/postfmapi/latest/post/assignTerminals', sourceTitle: 'Assign terminals', sourceLocator: 'deprecation:POS Terminal Management API', claims: [
      { key: 'status', value: 'deprecated in version 1' }, { key: 'affectedEndpoint', value: 'POST /postfmapi/terminal/v1/assignTerminals' }, { key: 'replacement', value: 'POST /terminals/{terminalId}/reassign' }, { key: 'supportEnds', value: '2025-04-01' },
    ] },
    payload: { changeId: 'adyen-terminal-assign-terminals-v1-deprecation', title: 'Adyen Terminal Management v1 assignTerminals deprecation', description: 'Adyen documents deprecation of the v1 assignTerminals operation, support ending April 1, 2025, and the reassign endpoint as the replacement. No SDK or unrelated Terminal API behavior is asserted.', changeType: 'endpoint_removed', effectiveAt: '2025-04-01', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['POST /postfmapi/terminal/v1/assignTerminals'], replacement: { endpoint: 'POST /terminals/{terminalId}/reassign' }, severity: 'high' },
  }),
];
