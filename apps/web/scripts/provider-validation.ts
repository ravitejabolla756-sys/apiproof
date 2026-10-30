import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import {
  DISCOVERY_PROVIDERS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  buildMigrationTemplateCoverageIndex,
  validateProviderDefinitions,
} from '@apiproof/providers';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const LAUNCH_PROVIDER_IDS = [
  'stripe', 'twilio', 'openai', 'firebase', 'github', 'aws', 'google-cloud', 'slack', 'sendgrid', 'shopify',
  'auth0', 'clerk', 'supabase', 'vercel', 'cloudflare', 'launchdarkly', 'elevenlabs', 'groq', 'braintree',
] as const;

function fail(messages: readonly string[]): never {
  for (const message of messages) console.error(`provider-validation: ${message}`);
  process.exitCode = 1;
  throw new Error('PROVIDER_VALIDATION_FAILED');
}

function validateCatalog(): void {
  const errors: string[] = [];
  try {
    validateProviderDefinitions(DISCOVERY_PROVIDERS);
    buildMigrationTemplateCoverageIndex(MIGRATION_TEMPLATE_COVERAGE);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Provider catalog validation failed.');
  }

  const discoveryIds = new Set(DISCOVERY_PROVIDERS.map((provider) => provider.id));
  const reviewedByProvider = new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.providerId));
  for (const providerId of LAUNCH_PROVIDER_IDS) {
    if (!discoveryIds.has(providerId)) errors.push(`missing discovery provider: ${providerId}`);
    if (!reviewedByProvider.has(providerId)) errors.push(`missing reviewed rule: ${providerId}`);
  }

  const ids = new Set<string>();
  for (const change of PRODUCTION_COMPATIBILITY_REGISTRY.changes) {
    if (ids.has(change.changeId)) errors.push(`duplicate change ID: ${change.changeId}`);
    ids.add(change.changeId);
    if (!discoveryIds.has(change.providerId)) errors.push(`rule references unknown provider: ${change.changeId}`);
    if (change.review.provenance !== 'official' || change.review.status !== 'reviewed') {
      errors.push(`rule is not officially reviewed: ${change.changeId}`);
    }
    if (!change.evidence.some((evidence) => evidence.url === change.officialSourceUrl)) {
      errors.push(`rule source is not present in evidence: ${change.changeId}`);
    }
  }

  const candidateIds = new Set(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => candidate.candidateId));
  const missingCandidates = PRODUCTION_COMPATIBILITY_REGISTRY.changes
    .filter((change) => !candidateIds.has(change.changeId))
    .map((change) => change.changeId);
  if (missingCandidates.length > 0) errors.push(`reviewed rules without official candidate records: ${missingCandidates.join(', ')}`);

  if (errors.length > 0) fail(errors);
  console.log(JSON.stringify({
    ok: true,
    monitoredProviders: LAUNCH_PROVIDER_IDS.length,
    discoveryProviders: DISCOVERY_PROVIDERS.length,
    reviewedRules: PRODUCTION_COMPATIBILITY_REGISTRY.changes.length,
    officialCandidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.length,
    templateProviders: MIGRATION_TEMPLATE_COVERAGE.length,
  }, null, 2));
}

function usageFor(change: ReviewedCompatibilityChange, providerId: string): CompatibilityUsage {
  const endpoint = change.affectedEndpoints?.[0];
  const domain = change.affectedDomains?.[0];
  return {
    id: `provider-validation-${change.changeId}`,
    providerId,
    packageName: change.affectedPackages?.[0],
    operation: change.apiOperationPatterns[0],
    parameter: change.affectedParameters[0],
    responseField: change.affectedResponseFields[0],
    endpoint,
    domain,
    model: change.affectedModels[0],
    resource: change.affectedResources[0],
    authOrHeader: change.authOrHeaderPatterns[0],
    apiVersion: change.apiVersionMetadata?.version,
    evidenceKind: endpoint || domain ? 'http' : 'sdk',
    confidence: 0.95,
    static: true,
    location: { file: `provider-validation/${change.providerId}.ts`, line: 1, column: 1 },
  };
}

function validateIsolation(): void {
  const providerIds = [...new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.providerId))];
  const errors: string[] = [];
  for (const change of PRODUCTION_COMPATIBILITY_REGISTRY.changes) {
    const foreignProvider = providerIds.find((providerId) => providerId !== change.providerId);
    if (!foreignProvider) continue;
    const usage = normalizeCompatibilityUsage(usageFor(change, foreignProvider), { language: 'typescript', versionSource: 'lockfile', versionConfidence: 'exact', resolvedVersion: '1.0.0' });
    const result = evaluateNormalizedCompatibility(
      { providerId: foreignProvider, usageIR: [usage], completeEvidence: true },
      change,
      { compatibilityProviders: new Set(providerIds), requireOfficialProvenance: true },
    );
    if (result.status === 'AFFECTED') errors.push(`cross-provider contamination: ${foreignProvider} matched ${change.changeId}`);
  }
  if (errors.length > 0) fail(errors);
  console.log(JSON.stringify({ ok: true, checkedRules: PRODUCTION_COMPATIBILITY_REGISTRY.changes.length, foreignProviderCases: PRODUCTION_COMPATIBILITY_REGISTRY.changes.length }, null, 2));
}

const mode = process.argv[2] ?? 'all';
if (mode === 'all') validateCatalog();
else if (mode === 'multi') validateIsolation();
else fail([`unknown mode: ${mode}`]);
