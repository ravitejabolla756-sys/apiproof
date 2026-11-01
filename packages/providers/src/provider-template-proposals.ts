import type { CandidateChange, PatchTransformation } from '@apiproof/shared';

export type ManualMigrationGuidance = {
  summary: string;
  steps: readonly string[];
  validation: readonly string[];
};

type ReviewOnlyTemplateProposalBase = {
  templateId: string;
  providerId: string;
  changeId: string;
  sourceUrl: string;
  limitation: string;
};

export type ReviewOnlyTemplateProposal =
  | (ReviewOnlyTemplateProposalBase & { mode: 'transform'; transformation: PatchTransformation })
  | (ReviewOnlyTemplateProposalBase & { mode: 'manual-guidance'; guidance: ManualMigrationGuidance });

const isLiteral = (value: string): boolean => value.length > 0 && !/[{}$`\n\r]/.test(value);
const isIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/.test(value);
const isConcreteApiVersion = (value: string): boolean => /^(?:\d{4}-\d{2}(?:-\d{2})?(?:\.[A-Za-z0-9-]+)?|\d{8})$/.test(value);

const MANUAL_GUIDANCE: Readonly<Record<string, ManualMigrationGuidance>> = {
  'aws-cloudwatch-evidently-end-of-support-2025-10-16': {
    summary: 'Remove CloudWatch Evidently usage and select a supported AWS feature-management or experimentation service.',
    steps: [
      'Locate Evidently client construction, launch/test APIs, resource identifiers, and infrastructure references.',
      'Choose and document the supported replacement service and map each experiment, feature, or evaluation flow.',
      'Replace the integration and remove obsolete Evidently resources; do not infer a one-to-one AWS API mapping.',
    ],
    validation: [
      'Run the replacement service integration tests against a non-production AWS account.',
      'Confirm no Evidently package, endpoint, resource, or deployment reference remains.',
      'Verify feature allocation, metrics, permissions, and rollback behavior with the owning team.',
    ],
  },
  'aws-javascript-sdk-v2-end-of-support-2025-09-08': {
    summary: 'Migrate AWS SDK for JavaScript v2 to modular AWS SDK for JavaScript v3 packages.',
    steps: [
      'Inventory each aws-sdk service constructor, import, credential configuration, and callback-based call site.',
      'Use the AWS-supported aws-sdk-js-codemod or an equivalent service-specific migration, then review every generated change.',
      'Replace v2 service clients with the corresponding modular v3 package and update middleware, pagination, and error handling as needed.',
    ],
    validation: [
      'Run TypeScript compilation and service-level tests for every migrated AWS client.',
      'Verify credentials, retries, pagination, streaming, and response shapes against a sandbox account.',
      'Confirm package-lock consistency and that no v2 runtime dependency remains.',
    ],
  },
  'google-cloud-api-registry-mcp-operations-removed-2026-07-30': {
    summary: 'Replace Cloud API Registry MCP management operations with the supported service-specific MCP endpoint flow.',
    steps: [
      'Identify calls that retrieve, list, enable, or disable MCP servers and tools through API Registry.',
      'Map each target service to its documented MCP endpoint and enable the underlying Google Cloud API explicitly.',
      'Rewrite orchestration and authorization around the service-specific endpoint; this is not a path-only replacement.',
    ],
    validation: [
      'Exercise discovery and invocation for each affected service in a non-production project.',
      'Verify IAM permissions, endpoint health, and failure handling for disabled or unavailable services.',
      'Confirm no API Registry MCP management operation remains in source or deployment configuration.',
    ],
  },
  'google-cloud-api-registry-mcp-shutdown-2026-07-30': {
    summary: 'Remove API Registry MCP server/tool operations and move to supported service-owned MCP endpoints.',
    steps: [
      'Inventory API Registry MCP server and tool retrieval, listing, enablement, and disablement calls.',
      'Select the supported service-owned MCP endpoint for each integration and update the service configuration.',
      'Update authorization, retries, and response handling for the new endpoint contract.',
    ],
    validation: [
      'Run an authenticated smoke test for every mapped service endpoint.',
      'Verify least-privilege IAM and expected behavior when a service API is disabled.',
      'Remove the retired API Registry operations and update operational runbooks.',
    ],
  },
  'slack-files-upload-removal-2025-11-12': {
    summary: 'Migrate files.upload to Slack’s asynchronous external upload flow.',
    steps: [
      'Replace files.upload with files.getUploadURLExternal and capture the returned upload URL and file identifier.',
      'Upload the bytes to the returned URL, then call files.completeUploadExternal with the intended channel and metadata.',
      'Preserve retries, idempotency, file visibility, and error handling across all three stages.',
    ],
    validation: [
      'Test small and large files, private/public channels, thread replies, and retry-after-failure behavior.',
      'Verify the completed file is accessible only to the intended Slack audience.',
      'Confirm no files.upload call remains in production code or tests.',
    ],
  },
  'slack-files-upload-retired-2025-03-11': {
    summary: 'Migrate the retired Slack files.upload method to the asynchronous external upload flow.',
    steps: [
      'Find every files.upload call and record its file bytes, filename, channel, thread, and initial comment behavior.',
      'Implement getUploadURLExternal, the binary upload, and completeUploadExternal as one guarded workflow.',
      'Preserve Slack scopes and handle partial completion without duplicating uploads.',
    ],
    validation: [
      'Exercise success, upload failure, completion failure, and retry scenarios.',
      'Verify channel/thread placement and metadata match the previous behavior.',
      'Confirm the retired method is absent from application code.',
    ],
  },
  'auth0-connections-enabled-clients-deprecated-2026-01-21': {
    summary: 'Move Auth0 enabled-client reads and updates to the dedicated Management API endpoints while preserving create semantics.',
    steps: [
      'Separate connection creation from connection retrieval and update code paths.',
      'Replace enabled_clients on GET/PATCH connection operations with the dedicated enabled-client endpoints.',
      'Keep enabled_clients only where the source explicitly permits it during connection creation.',
    ],
    validation: [
      'Test connection creation, read, update, pagination, and authorization with representative tenants.',
      'Verify client associations before and after updates and confirm create behavior remains intact.',
      'Confirm no deprecated field usage remains on GET/PATCH paths.',
    ],
  },
  'auth0-enabled-clients-field-deprecation-2026-07-13': {
    summary: 'Replace Auth0 connection enabled_clients management with the dedicated enabled-client endpoints.',
    steps: [
      'Classify each occurrence by HTTP operation; the deprecation does not apply identically to connection creation.',
      'Rewrite GET and PATCH flows to the dedicated endpoints and preserve tenant, connection, and client identifiers.',
      'Review token scopes and response-shape handling for the new endpoint family.',
    ],
    validation: [
      'Run read and update contract tests with a least-privilege Management API token.',
      'Verify connection creation still handles its documented enabled_clients exception.',
      'Search for and review every remaining enabled_clients occurrence.',
    ],
  },
  'auth0-legacy-enabled-clients-management-deprecation-2026-07-13': {
    summary: 'Migrate legacy Auth0 enabled-client management to dedicated connection client endpoints.',
    steps: [
      'Inventory GET and PATCH connection operations that read or write connection.enabled_clients.',
      'Map each operation to Auth0’s get-enabled-clients or update-enabled-clients endpoint.',
      'Preserve tenant routing, authorization, retries, and the connection-creation exception.',
    ],
    validation: [
      'Run authenticated read/update tests and verify the resulting client associations.',
      'Check scopes and error handling for missing connections or clients.',
      'Confirm no legacy management path is used outside the documented creation case.',
    ],
  },
  'vercel-legacy-integration-webhook-endpoints-removal-2021-08-20': {
    summary: 'Replace legacy Vercel integration webhook endpoints with the current generic webhook configuration.',
    steps: [
      'Locate calls to the removed metadata and webhook endpoint family and identify the integration lifecycle they implement.',
      'Configure a generic Webhook URL in the integration settings and adapt the receiver to the current event contract.',
      'Remove unsupported UI Hook/manual webhook management assumptions from the integration service.',
    ],
    validation: [
      'Send representative integration events to a non-production receiver and verify signatures and delivery retries.',
      'Confirm lifecycle settings no longer depend on the removed REST endpoints.',
      'Review secrets, replay protection, and event deduplication before enabling production traffic.',
    ],
  },
  'vercel-webhooks-rest-api-removed': {
    summary: 'Move Vercel integration webhook management from the removed REST API to generic Webhook URL configuration.',
    steps: [
      'Remove list/create/delete Webhook REST calls and document the integration’s desired event delivery configuration.',
      'Configure the generic Webhook URL through the supported integration settings workflow.',
      'Update the receiver and operational controls for the current webhook delivery contract.',
    ],
    validation: [
      'Verify event delivery, signature validation, retries, and duplicate suppression in a non-production integration.',
      'Confirm no removed Vercel webhook REST endpoint remains in source or infrastructure.',
      'Document the manual configuration dependency for operators.',
    ],
  },
  'braintree-drop-in-sdk-deprecated-2026-10-01': {
    summary: 'Replace Braintree Drop-in with the supported platform SDK and preserve payment, vault, and verification behavior.',
    steps: [
      'Choose the platform-specific Braintree SDK and inventory Drop-in UI options, tokenization, 3DS, and vault behavior.',
      'Implement the replacement UI/client flow and update the server-side transaction or payment-method contract.',
      'Migrate configuration, webhooks, fraud controls, and customer support flows together; do not perform a text-only rename.',
    ],
    validation: [
      'Run sandbox payment, 3DS, failure, refund, vault, and webhook tests.',
      'Verify PCI scope, nonce handling, idempotency, and client/server version compatibility.',
      'Confirm Drop-in assets and package references are removed only after the replacement is accepted.',
    ],
  },
  'braintree-transparent-redirect-deprecation': {
    summary: 'Replace Braintree Transparent Redirect with Braintree.js or Drop-in UI after selecting the supported checkout flow.',
    steps: [
      'Inventory Transparent Redirect forms, server endpoints, nonce handling, and failure/redirect states.',
      'Select Braintree.js or the supported Drop-in UI and redesign the checkout boundary around its tokenization contract.',
      'Update server validation, order state, retries, and user-facing recovery for the new flow.',
    ],
    validation: [
      'Run sandbox success, decline, cancellation, duplicate-submit, and webhook reconciliation tests.',
      'Verify nonce and payment state cannot be replayed or trusted without server validation.',
      'Confirm Transparent Redirect endpoints and hidden-form assumptions are removed.',
    ],
  },
};

function manualGuidanceProposal(candidate: CandidateChange): ReviewOnlyTemplateProposal | undefined {
  const guidance = MANUAL_GUIDANCE[candidate.candidateId];
  if (!guidance) return undefined;
  const changeId = candidate.payload.changeId ?? candidate.candidateId;
  return {
    templateId: `${candidate.providerId}-${changeId}-manual-review`,
    providerId: candidate.providerId,
    changeId,
    sourceUrl: candidate.sourceUrl,
    mode: 'manual-guidance',
    guidance,
    limitation: 'Manual review playbook only. No executable transformation is registered because the migration changes behavior, configuration, or multiple API calls.',
  };
}

function genericManualGuidanceProposal(candidate: CandidateChange): ReviewOnlyTemplateProposal {
  const changeId = candidate.payload.changeId ?? candidate.candidateId;
  const affected = [
    ...(candidate.payload.affectedPackages ?? []),
    ...(candidate.payload.affectedResources ?? []),
    ...(candidate.payload.affectedEndpoints ?? []),
    ...(candidate.payload.affectedParameters ?? []),
    ...(candidate.payload.affectedModels ?? []),
    ...(candidate.payload.affectedResponseFields ?? []),
    ...(candidate.payload.authOrHeaderPatterns ?? []),
  ];
  const replacement = [
    ...(candidate.payload.replacement?.resources ?? []),
    ...(candidate.payload.replacement?.endpoint ? [candidate.payload.replacement.endpoint] : []),
    ...(candidate.payload.replacement?.model ? [candidate.payload.replacement.model] : []),
    ...(candidate.payload.replacement?.parameter ? [candidate.payload.replacement.parameter] : []),
    ...(candidate.payload.replacement?.authOrHeader ? [candidate.payload.replacement.authOrHeader] : []),
  ];
  const affectedSummary = [...new Set(affected)].slice(0, 8).join(', ') || 'the source-described API surface';
  const replacementSummary = [...new Set(replacement)].slice(0, 6).join(', ') || 'the provider-supported replacement documented by the source';
  return {
    templateId: `${candidate.providerId}-${changeId}-manual-review`,
    providerId: candidate.providerId,
    changeId,
    sourceUrl: candidate.sourceUrl,
    mode: 'manual-guidance',
    guidance: {
      summary: `Review ${candidate.providerId} usage of ${affectedSummary} and migrate to ${replacementSummary}.`,
      steps: [
        `Inventory every source and deployment reference to ${affectedSummary}; keep the source-backed applicability scope intact.`,
        `Choose and implement the documented replacement (${replacementSummary}) with provider-specific review of request, response, authentication, and runtime behavior.`,
        'Do not promote a text-only replacement when the source does not establish an exact call shape, package scope, or behavioral equivalence.',
      ],
      validation: [
        'Run affected, unaffected, and uncertain fixtures plus the provider integration tests in a non-production environment.',
        'Verify the replacement request/response contract, authentication, retries, pagination, and rollback behavior where applicable.',
        'Search for the retired symbol or endpoint, review all remaining matches, and record the source fingerprint and reviewer decision.',
      ],
    },
    limitation: 'Manual review playbook only. No executable transformation is registered because the source does not prove a safe, behavior-preserving AST rewrite.',
  };
}

/**
 * Derives only a review artifact from explicit candidate facts. The result is
 * never an executable template: approval, fixture verification, and digest
 * binding are still required before a transformation can reach patching.
 */
export function deriveReviewOnlyTemplateProposal(candidate: CandidateChange): ReviewOnlyTemplateProposal | undefined {
  const manual = manualGuidanceProposal(candidate);
  if (manual) return manual;
  const changeId = candidate.payload.changeId ?? candidate.candidateId;
  const replacement = candidate.payload.replacement;
  if (!replacement) return genericManualGuidanceProposal(candidate);

  const resources = candidate.payload.affectedResources ?? [];
  const replacementResources = replacement.resources ?? [];
  const packages = candidate.payload.affectedPackages ?? [];

  const apiVersion = candidate.payload.apiVersionMetadata;
  if (apiVersion?.replacement && isConcreteApiVersion(apiVersion.version) && isConcreteApiVersion(apiVersion.replacement)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-api-version-literal-review`,
      providerId: candidate.providerId,
      changeId,
      sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'api-version-literal-rename', property: 'apiVersion', from: apiVersion.version, to: apiVersion.replacement, preserveArguments: true },
      limitation: 'Review-only proposal. Only a concrete API-version literal is eligible; SDK-version ranges, wildcard versions, dynamic configuration, provider-specific compatibility, fixtures, and human review must be verified before promotion.',
    };
  }

  if (packages.length === 1 && resources.length === 1 && replacementResources.length === 1
    && resources[0]!.startsWith(`${packages[0]!}/`) && replacementResources[0]!.startsWith(`${packages[0]!}/`)
    && isLiteral(resources[0]!) && isLiteral(replacementResources[0]!)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-import-specifier-review`, providerId: candidate.providerId, changeId, sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'import-specifier-rename', from: resources[0]!, to: replacementResources[0]!, preserveBindings: true },
      limitation: 'Review-only proposal. Only an exact static import specifier is eligible; package/version scope, export compatibility, fixtures, and human review must be verified before promotion.',
    };
  }

  const models = candidate.payload.affectedModels ?? [];
  if (models.length === 1 && replacement.model && isLiteral(models[0]!) && isLiteral(replacement.model)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-model-literal-review`,
      providerId: candidate.providerId,
      changeId,
      sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'model-literal-rename', property: 'model', from: models[0]!, to: replacement.model, preserveArguments: true },
      limitation: 'Review-only proposal. Dynamic model variables, aliases, configuration lookups, and non-literal values are excluded until fixtures and human review pass.',
    };
  }

  const endpoints = candidate.payload.affectedEndpoints ?? [];
  if (endpoints.length === 1 && replacement.endpoint && isLiteral(endpoints[0]!) && isLiteral(replacement.endpoint)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-endpoint-literal-review`,
      providerId: candidate.providerId,
      changeId,
      sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'string-literal-rename', from: endpoints[0]!, to: replacement.endpoint, preserveArguments: true },
      limitation: 'Review-only proposal. Response-shape changes, dynamic URL construction, aliases, and non-literal values are excluded until fixtures and human review pass.',
    };
  }

  const domains = candidate.payload.affectedDomains ?? [];
  if (domains.length > 0 && replacement.domain && domains.every(isLiteral) && isLiteral(replacement.domain)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-domain-literal-review`,
      providerId: candidate.providerId,
      changeId,
      sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'string-literal-rename-many', replacements: domains.map((from) => ({ from, to: replacement.domain! })), preserveArguments: true },
      limitation: 'Review-only proposal. Dynamic URL construction, aliases, host validation, and behavior changes are excluded until fixtures and human review pass.',
    };
  }

  const parameters = candidate.payload.affectedParameters ?? [];
  if (parameters.length === 1 && replacement.parameter && isIdentifier(parameters[0]!) && isIdentifier(replacement.parameter)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-parameter-review`,
      providerId: candidate.providerId,
      changeId,
      sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'member-rename', from: parameters[0]!, to: replacement.parameter, receiver: 'provider', preserveArguments: true },
      limitation: 'Review-only proposal. The source must establish the exact object receiver and call shape before an executable AST rule can be approved.',
    };
  }

  const operations = candidate.payload.apiOperationPatterns ?? [];
  const replacementOperations = replacement.operation?.split('/').map((value) => value.trim()).filter(Boolean) ?? [];
  if (operations.length > 0 && operations.length === replacementOperations.length
    && operations.every(isIdentifier) && replacementOperations.every(isIdentifier)) {
    return {
      templateId: `${candidate.providerId}-${changeId}-identifier-review`,
      providerId: candidate.providerId,
      changeId,
      sourceUrl: candidate.sourceUrl,
      mode: 'transform',
      transformation: { kind: 'identifier-rename-many', replacements: operations.map((from, index) => ({ from, to: replacementOperations[index]! })), preserveBindings: true },
      limitation: 'Review-only proposal. Only exact identifiers at source-backed locations are eligible; import/export compatibility, overloads, aliases, fixtures, and human review must be verified before promotion.',
    };
  }

  return genericManualGuidanceProposal(candidate);
}
