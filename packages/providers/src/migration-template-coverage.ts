/**
 * Explicit readiness boundary for migration generation.
 *
 * Discovery, a reviewed compatibility rule, and an executable migration
 * template are separate capabilities. This catalog deliberately records the
 * absence of a template instead of inferring one from a replacement sentence
 * or from a provider's package metadata.
 */
export type MigrationTemplateStatus = 'deterministic-ast' | 'review-only';

export interface MigrationTemplateCoverage {
  readonly providerId: string;
  readonly status: MigrationTemplateStatus;
  readonly templateIds: readonly string[];
  readonly supportedLanguages: readonly ('typescript' | 'javascript')[];
  readonly requiresHumanReview: true;
  readonly limitation: string;
}

const reviewOnly = (providerId: string): MigrationTemplateCoverage => ({
  providerId,
  status: 'review-only',
  templateIds: [],
  supportedLanguages: [],
  requiresHumanReview: true,
  limitation: 'No digest-bound executable migration template is registered; findings remain review-only.',
});

/** Current launch-catalog migration coverage, kept explicit and auditable. */
export const MIGRATION_TEMPLATE_COVERAGE: readonly MigrationTemplateCoverage[] = [
  {
    providerId: 'stripe',
    status: 'deterministic-ast',
    templateIds: ['stripe-subscription-coupon-removed', 'stripe-subscriptions-del-removed', 'stripe-context-type-renamed'],
    supportedLanguages: ['typescript'],
    requiresHumanReview: true,
    limitation: 'Digest-bound TypeScript AST transformations; aliases and dynamic expressions remain review-only.',
  },
  {
    providerId: 'twilio',
    status: 'deterministic-ast',
    templateIds: ['twilio-twiml-namespace-casing', 'twilio-regional-api-domain-removal-2026-04-28', 'twilio-studio-engagements-endpoint-deprecated'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Namespace casing and direct string-literal domain references only; all seven reviewed regional domains are covered, while aliases, dynamic URLs and non-literal construction remain review-only.',
  },
  {
    providerId: 'openai',
    status: 'deterministic-ast',
    templateIds: ['openai-gpt-4-5-preview-removal-2025-07-14'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Literal model properties only; dynamic configuration and Assistants-to-Responses migrations remain review-only.',
  },
  {
    providerId: 'firebase',
    status: 'deterministic-ast',
    templateIds: ['firebase-vertexai-import-alias-removed-2025-07-17', 'firebase-vertexai-symbols-removed-2025-07-17'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static firebase/vertexai import-specifier and named identifier replacements only; dynamic module construction, aliases, and broader SDK behavior remain review-only.',
  },
  {
    providerId: 'github',
    status: 'deterministic-ast',
    templateIds: ['github-synchronous-sbom-endpoint-removal-2026-11-13'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Direct string-literal endpoint references only; template construction and asynchronous response handling remain review-only.',
  },
  reviewOnly('aws'),
  reviewOnly('google-cloud'),
  reviewOnly('slack'),
  {
    providerId: 'shopify',
    status: 'deterministic-ast',
    templateIds: ['shopify-api-2025-10-version-retired-2026-10-16'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static apiVersion object-property literals only; URL paths, headers, aliases, and dynamically selected versions remain review-only.',
  },
  reviewOnly('auth0'),
  {
    providerId: 'clerk',
    status: 'deterministic-ast',
    templateIds: ['clerk-core-3-after-switch-organization-url-removed'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static JSX attribute rename only; non-JSX wrappers, dynamic prop forwarding, and behavioral migration remain review-only.',
  },
  {
    providerId: 'supabase',
    status: 'deterministic-ast',
    templateIds: ['supabase-management-logs-all-removal-2026-09-23'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Direct string-literal logs.all endpoint references only; query-shape and dynamic endpoint changes remain review-only.',
  },
  reviewOnly('vercel'),
  {
    providerId: 'cloudflare',
    status: 'deterministic-ast',
    templateIds: ['cloudflare-workers-kv-legacy-routes-2026-10-15'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static legacy Workers KV route literals only; dynamic URL construction, authentication, aliases, and endpoint semantics remain review-only.',
  },
  {
    providerId: 'launchdarkly',
    status: 'deterministic-ast',
    templateIds: ['launchdarkly-api-version-20220603-eol-2025-04-15'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static apiVersion literals only; dynamic version selection, headers, aliases, and endpoint behavior remain review-only.',
  },
  {
    providerId: 'elevenlabs',
    status: 'deterministic-ast',
    templateIds: ['elevenlabs-legacy-dubbing-endpoints-deprecated'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static /v1/dubbing endpoint literals only; project-specific routes, dynamic URLs, and request/response behavior remain review-only.',
  },
  {
    providerId: 'groq',
    status: 'deterministic-ast',
    templateIds: ['groq-qwen-3-6-27b-retired-2026-09-14'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Literal model properties only; tier-specific eligibility, aliases, dynamic configuration, and request-shape changes remain review-only.',
  },
  reviewOnly('braintree'),
  {
    providerId: 'sendgrid',
    status: 'deterministic-ast',
    templateIds: ['sendgrid-web-api-v2-mail-send-migration', 'sendgrid-v2-mail-send-migration-to-v3'],
    supportedLanguages: ['typescript', 'javascript'],
    requiresHumanReview: true,
    limitation: 'Exact static /api/mail.send.json endpoint literals only; authentication, payload shape, and dynamic URL construction remain review-only.',
  },
];

export function buildMigrationTemplateCoverageIndex(
  coverage: readonly MigrationTemplateCoverage[] = MIGRATION_TEMPLATE_COVERAGE,
): ReadonlyMap<string, MigrationTemplateCoverage> {
  const index = new Map<string, MigrationTemplateCoverage>();
  for (const entry of coverage) {
    if (index.has(entry.providerId)) throw new Error(`DUPLICATE_MIGRATION_TEMPLATE_PROVIDER:${entry.providerId}`);
    if (entry.status === 'review-only' && entry.templateIds.length > 0) throw new Error(`REVIEW_ONLY_TEMPLATE_IDS:${entry.providerId}`);
    if (entry.status === 'deterministic-ast' && entry.templateIds.length === 0) throw new Error(`DETERMINISTIC_TEMPLATE_IDS_REQUIRED:${entry.providerId}`);
    index.set(entry.providerId, entry);
  }
  return index;
}

/** Returns true only when a change has an explicitly cataloged executable template. */
export function hasExecutableMigrationTemplate(
  changeId: string,
  coverage: readonly MigrationTemplateCoverage[] = MIGRATION_TEMPLATE_COVERAGE,
): boolean {
  return coverage.some((entry) => entry.status === 'deterministic-ast' && entry.templateIds.includes(changeId));
}
