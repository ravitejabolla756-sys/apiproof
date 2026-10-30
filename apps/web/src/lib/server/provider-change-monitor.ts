import { createHash } from 'node:crypto';
import { getDatabase } from './db/index.js';
import { DEDICATED_TIER_2_PROVIDERS, DEDICATED_TIER_3_PROVIDERS, getProviderChangelogProfile, parseDedicatedProviderChangelog, parseTier1ProviderChangelog, TIER_1_PROVIDERS, type DedicatedProvider, type Tier1Provider } from './provider-changelog-adapters.js';
import { fetchOfficialSource } from './provider-source-fetch.js';
import type { SourceFetchOptions, SourceRow } from './provider-source-fetch.js';
import { enqueueProviderChangeSlackNotifications } from './slack-provider-change-notifications.js';
import { enqueueProviderSourceChangeRescans, enqueueRepositoryProviderSourceChangeRescans } from './repository-rescan-worker.js';

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type ProviderChangeSource = {
  readonly id: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly sourceUrl: string;
  readonly sourceType: 'official-changelog' | 'official-documentation' | 'release-notes' | 'deprecation-notice' | 'official-api-reference';
  readonly adapterId: Tier1Provider | DedicatedProvider | 'profiled-official-source' | 'generic-official-source';
};

/** The supported launch catalog is explicit: no provider is implied by discovery alone. */
export const PROVIDER_CHANGE_SOURCES: readonly ProviderChangeSource[] = [
  { id: 'stripe-changelog', providerId: 'stripe', displayName: 'Stripe', sourceUrl: 'https://stripe.com/docs/upgrades', sourceType: 'official-changelog', adapterId: 'stripe' },
  { id: 'twilio-changelog', providerId: 'twilio', displayName: 'Twilio', sourceUrl: 'https://www.twilio.com/en-us/changelog', sourceType: 'official-changelog', adapterId: 'twilio' },
  { id: 'openai-deprecations', providerId: 'openai', displayName: 'OpenAI', sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice', adapterId: 'openai' },
  { id: 'firebase-release-notes', providerId: 'firebase', displayName: 'Firebase', sourceUrl: 'https://firebase.google.com/support/release-notes/js', sourceType: 'release-notes', adapterId: 'firebase' },
  { id: 'github-api-versions', providerId: 'github', displayName: 'GitHub', sourceUrl: 'https://docs.github.com/en/rest/overview/api-versions', sourceType: 'official-documentation', adapterId: 'github' },
  { id: 'aws-breaking-changes', providerId: 'aws', displayName: 'AWS', sourceUrl: 'https://docs.aws.amazon.com/sdk-for-javascript/latest/developer-guide/breaking-changes.html', sourceType: 'official-documentation', adapterId: 'aws' },
  { id: 'google-cloud-release-notes', providerId: 'google-cloud', displayName: 'Google Cloud', sourceUrl: 'https://cloud.google.com/java/docs/release-notes', sourceType: 'release-notes', adapterId: 'google-cloud' },
  { id: 'slack-changelog', providerId: 'slack', displayName: 'Slack', sourceUrl: 'https://api.slack.com/changelog', sourceType: 'official-changelog', adapterId: 'slack' },
  { id: 'sendgrid-release-notes', providerId: 'sendgrid', displayName: 'SendGrid', sourceUrl: 'https://sendgrid.com/docs/release-notes/', sourceType: 'release-notes', adapterId: 'sendgrid' },
  { id: 'shopify-release-notes', providerId: 'shopify', displayName: 'Shopify', sourceUrl: 'https://shopify.dev/api/release-notes', sourceType: 'release-notes', adapterId: 'shopify' },
  { id: 'auth0-changelog', providerId: 'auth0', displayName: 'Auth0', sourceUrl: 'https://auth0.com/changelog', sourceType: 'official-changelog', adapterId: 'auth0' },
  { id: 'clerk-changelog', providerId: 'clerk', displayName: 'Clerk', sourceUrl: 'https://clerk.com/changelog', sourceType: 'official-changelog', adapterId: 'clerk' },
  { id: 'supabase-features', providerId: 'supabase', displayName: 'Supabase', sourceUrl: 'https://supabase.com/docs/guides/getting-started/features', sourceType: 'official-documentation', adapterId: 'supabase' },
  { id: 'vercel-changelog', providerId: 'vercel', displayName: 'Vercel', sourceUrl: 'https://vercel.com/changelog', sourceType: 'official-changelog', adapterId: 'vercel' },
  { id: 'cloudflare-release-notes', providerId: 'cloudflare', displayName: 'Cloudflare', sourceUrl: 'https://developers.cloudflare.com/api/release-notes/', sourceType: 'release-notes', adapterId: 'cloudflare' },
  { id: 'launchdarkly-api-changelog', providerId: 'launchdarkly', displayName: 'LaunchDarkly', sourceUrl: 'https://launchdarkly.com/api/changelog', sourceType: 'official-changelog', adapterId: 'launchdarkly' },
  { id: 'elevenlabs-api-reference', providerId: 'elevenlabs', displayName: 'ElevenLabs', sourceUrl: 'https://elevenlabs.io/docs/api-reference/overview', sourceType: 'official-api-reference', adapterId: 'elevenlabs' },
  { id: 'groq-api-docs', providerId: 'groq', displayName: 'Groq', sourceUrl: 'https://console.groq.com/docs/api', sourceType: 'official-api-reference', adapterId: 'groq' },
  { id: 'braintree-reference', providerId: 'braintree', displayName: 'Braintree', sourceUrl: 'https://developer.braintreepayments.com/reference/request', sourceType: 'official-api-reference', adapterId: 'braintree' },
];

const sourceByProvider = new Map(PROVIDER_CHANGE_SOURCES.map((source) => [source.providerId, source]));

export type ProviderChangelogRefreshResult = {
  providerId: string;
  sourceUrl: string;
  status: 'baseline' | 'unchanged' | 'changed' | 'failed' | 'skipped';
  entryId?: string;
  candidateId?: string;
  detectedChanges?: number;
  parserStatus?: 'structured' | 'review-only';
  rescansQueued?: number;
  repositoryRescansQueued?: number;
  errorCode?: string;
  skipReason?: 'not_due';
  nextAttemptAt?: string;
};

export type ProviderChangelogRefreshOptions = SourceFetchOptions & { now?: () => Date };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function nextAttempt(now: Date): string {
  return new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString();
}

function sourceDescription(source: ProviderChangeSource, hash: string, first: boolean): string {
  return first
    ? `Initial official ${source.displayName} source snapshot recorded. No production rule was created.`
    : `The official ${source.displayName} source changed. The new document fingerprint is ${hash}. Human review is required before any compatibility rule can affect scans.`;
}

export type StructuredChange = {
  key: string;
  title: string;
  description: string;
  sourceLocator: string;
  payload: Record<string, unknown>;
};

export type ParserStatus = 'structured' | 'review-only';

function decodeHtml(value: string): string {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#x27;/gi, "'").replace(/&#39;/gi, "'");
}

/**
 * OpenAI publishes deprecations as factual model/date/replacement tables.
 * This parser extracts only rows with a model and shutdown date; it never
 * invents an operation, package, or version scope.
 */
function parseOpenAiDeprecations(source: ProviderChangeSource, body: string): StructuredChange[] {
  const text = decodeHtml(body.replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`').replace(/<\/tr>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
  const changes: StructuredChange[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})/i);
    const models = [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((value): value is string => Boolean(value));
    if (!dateMatch || models.length < 1 || /shutdown date|model \/ system|recommended replacement/i.test(line)) continue;
    const affectedModel = models[0];
    if (!affectedModel || affectedModel.includes('://') || affectedModel.length > 150) continue;
    const replacement = models.length > 1 ? models[models.length - 1] : undefined;
    const key = `openai-model-${sha256(`${affectedModel}:${dateMatch[1]}`).slice(0, 24)}`;
    changes.push({
      key,
      title: `OpenAI model deprecation: ${affectedModel}`,
      description: line.slice(0, 2_000),
      sourceLocator: `${source.sourceUrl}#${key}`,
      payload: {
        changeId: key,
        title: `OpenAI model deprecation: ${affectedModel}`,
        sourceTitle: 'OpenAI API deprecations',
        description: line.slice(0, 2_000),
        changeType: 'model_retired',
        applicabilityScope: { dimensions: ['provider', 'model'] },
        affectedModels: [affectedModel],
        ...(replacement && replacement !== affectedModel ? { replacement: { model: replacement } } : {}),
        sourceFacts: [`The official deprecations page lists ${affectedModel} with shutdown date ${dateMatch[1]}.`],
        unknowns: ['Package and call-site scope must be confirmed during review.'],
        severity: 'high',
      },
    });
  }
  return changes;
}

function sourceText(body: string): string {
  return decodeHtml(body
    .replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ');
}

function boundedIdentifier(value: string | undefined, maxLength = 160): string | undefined {
  const normalized = value?.replace(/[.,;:()[\]{}]+$/g, '').trim();
  return normalized && normalized.length <= maxLength && !/^https?:\/\//i.test(normalized) ? normalized : undefined;
}

function normalizeDateToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value.replaceAll('/', '-'));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Conservative shared parser for the other official sources. It emits a
 * typed candidate only when the source contains both a high-confidence
 * lifecycle verb and a concrete API identifier. Otherwise the caller keeps
 * the source as an unstructured review candidate.
 */
function parseHighConfidenceProviderChanges(source: ProviderChangeSource, body: string): StructuredChange[] {
  const text = sourceText(body);
  const profile = getProviderChangelogProfile(source.providerId);
  const changes: StructuredChange[] = [];
  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const line of lines) {
    const lifecycle = line.match(/\b(deprecat(?:ed|ion)|sunset|retir(?:ed|ing)|removed|removal|no longer supported|breaking change)\b/i);
    if (!lifecycle) continue;
    const profiledIdentifierKind = profile?.identifierKind;
    const date = line.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2})\b/i)?.[1];
    const codeTokens = [...line.matchAll(/`([^`]+)`/g)].map((match) => boundedIdentifier(match[1])).filter((value): value is string => Boolean(value));
    const profiledToken = profile?.identifierPatterns
      .flatMap((pattern) => {
        const codeToken = codeTokens.find((token) => {
          pattern.lastIndex = 0;
          return pattern.test(token);
        });
        return codeToken ?? line.match(pattern)?.[0] ?? [];
      })
      .find((value): value is string => Boolean(value));
    if (profiledToken && !codeTokens.includes(profiledToken)) codeTokens.push(profiledToken);
    const endpoint = line.match(/\/(?:v\d+\/)?[A-Za-z0-9_.{}:-]+(?:\/[A-Za-z0-9_.{}:-]+){1,8}/)?.[0];
    const model = codeTokens.find((token) => /(?:^|[-_.:/])(?:gpt|claude|gemini|llama|mistral|command|sonnet|opus|turbo|model)[-_:.]/i.test(token));
    const apiVersion = profiledIdentifierKind === 'api_version'
      ? profiledToken
      : line.match(/\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{4}-\d{2}-\d{2})\b/)?.[0];
    let changeType: 'parameter_removed' | 'endpoint_removed' | 'model_retired' | 'api_version_retired' | 'enum_changed';
    let dimensions: string[];
    let affectedModels: string[] = [];
    let affectedEndpoints: string[] = [];
    let affectedParameters: string[] = [];
    let apiVersionMetadata: Record<string, string> | undefined;
    let enumMetadata: Record<string, unknown> | undefined;
    let keyValue: string | undefined;
    if (model) {
      changeType = 'model_retired';
      dimensions = ['provider', 'model'];
      affectedModels = [model];
      keyValue = model;
    } else if (endpoint && /endpoint|route|path|url/i.test(line)) {
      changeType = 'endpoint_removed';
      dimensions = ['provider', 'endpoint'];
      affectedEndpoints = [endpoint];
      keyValue = endpoint;
    } else if (apiVersion && /version|api[- ]?date|release/i.test(line)) {
      changeType = 'api_version_retired';
      dimensions = ['provider', 'api_version'];
      apiVersionMetadata = { version: apiVersion };
      keyValue = apiVersion;
    } else if (/\bparameter\b|\bfield\b|\bargument\b|\bproperty\b/i.test(line) && codeTokens[0]) {
      changeType = 'parameter_removed';
      dimensions = ['provider', 'parameter', 'operation'];
      affectedParameters = [codeTokens[0]];
      keyValue = codeTokens[0];
    } else if (/\benum\b|\bvalue\b|\bconstant\b/i.test(line) && codeTokens[0]) {
      changeType = 'enum_changed';
      dimensions = ['provider', 'enum'];
      enumMetadata = { name: codeTokens[0], removedValues: [], addedValues: [] };
      keyValue = codeTokens[0];
    } else if (profiledToken) {
      const identifierKind = profiledIdentifierKind ?? 'operation';
      if (identifierKind === 'model') {
        changeType = 'model_retired';
        dimensions = ['provider', 'model'];
        affectedModels = [profiledToken];
      } else if (identifierKind === 'endpoint') {
        changeType = 'endpoint_removed';
        dimensions = ['provider', 'endpoint'];
        affectedEndpoints = [profiledToken];
      } else if (identifierKind === 'api_version') {
        changeType = 'api_version_retired';
        dimensions = ['provider', 'api_version'];
        apiVersionMetadata = { version: profiledToken };
      } else if (identifierKind === 'service') {
        changeType = 'endpoint_removed';
        dimensions = ['provider', 'resource'];
        keyValue = profiledToken;
      } else {
        // Provider profiles identify an SDK operation, not a parameter. Use
        // endpoint_removed with an operation target so the shared scope
        // validator can approve it without inventing package/version data.
        changeType = 'endpoint_removed';
        dimensions = ['provider', 'operation'];
      }
      keyValue = keyValue ?? profiledToken;
    } else {
      continue;
    }
    const fingerprintKey = `${source.providerId}:${changeType}:${keyValue}:${date ?? line}`;
    const key = `${source.providerId}-detected-${sha256(fingerprintKey).slice(0, 24)}`;
    const description = line.slice(0, 2_000);
    changes.push({
      key,
      title: `${source.displayName} ${changeType.replaceAll('_', ' ')}: ${keyValue}`,
      description,
      sourceLocator: `${source.sourceUrl}#${key}`,
      payload: {
        changeId: key,
        title: `${source.displayName} ${changeType.replaceAll('_', ' ')}: ${keyValue}`,
        sourceTitle: `${source.displayName} official change source`,
        description,
        changeType,
        applicabilityScope: { dimensions },
        affectedModels,
        affectedEndpoints,
        affectedParameters,
        ...(profiledIdentifierKind === 'service' ? { affectedResources: [profiledToken] } : {}),
        apiOperationPatterns: dimensions.includes('operation') ? [keyValue ?? 'unknown-operation'] : [],
        ...(apiVersionMetadata ? { apiVersionMetadata } : {}),
        ...(enumMetadata ? { enumMetadata } : {}),
        ...(normalizeDateToken(date) ? { removalAt: normalizeDateToken(date) } : {}),
        sourceFacts: [`The official ${source.displayName} source contains a ${lifecycle[1]} notice for ${keyValue}.`],
        unknowns: ['Package, version range, and exact call-site scope require human review.'],
        severity: 'high',
      },
    });
  }
  return changes.slice(0, 25);
}

function parseStructuredChanges(source: ProviderChangeSource, body: string): { changes: StructuredChange[]; parserStatus: ParserStatus } {
  if ((TIER_1_PROVIDERS as readonly string[]).includes(source.providerId)) {
    return { parserStatus: 'structured', changes: parseTier1ProviderChangelog(source.providerId as Tier1Provider, body, { sourceUrl: source.sourceUrl }).changes.map((change) => {
      const identifiers = change.identifiers;
      const affectedEndpoints = identifiers.filter((item) => item.kind === 'endpoint').map((item) => item.value);
      const affectedParameters = identifiers.filter((item) => item.kind === 'parameter').map((item) => item.value);
      const affectedModels = identifiers.filter((item) => item.kind === 'model').map((item) => item.value);
      const affectedResources = identifiers.filter((item) => item.kind === 'service').map((item) => item.value);
      const apiOperationPatterns = [...new Set(identifiers
        .filter((item) => item.kind === 'sdk_method')
        .flatMap((item) => [item.value, item.value.split('.').at(-1)]).filter((value): value is string => Boolean(value)))];
      const apiVersion = identifiers.find((item) => item.kind === 'api_version')?.value;
      const apiVersionMetadata = apiVersion ? { version: apiVersion } : undefined;
      const replacement = change.replacement;
      // Adapter-specific names are normalized at the reviewed-registry boundary.
      // The shared contract intentionally uses provider-neutral compatibility types.
      const normalizedChangeType = change.changeType === 'sdk_method_removed'
        ? 'method_removed'
        : change.changeType === 'service_deprecated'
          ? 'endpoint_removed'
          : change.changeType;
      const dimensions = identifiers
        .filter((item) => item.kind !== 'service' || change.changeType === 'service_deprecated')
        .map((item) => item.kind === 'sdk_method' ? 'operation' : item.kind === 'service' ? 'resource' : item.kind);
      const key = change.id;
      return {
        key,
        title: change.title,
        description: change.evidence.excerpt,
        sourceLocator: `${source.sourceUrl}#${change.evidence.locator}`,
        payload: {
          changeId: key,
          title: change.title,
          sourceTitle: `${source.displayName} official change source`,
          description: change.evidence.excerpt,
          changeType: normalizedChangeType,
          applicabilityScope: { dimensions: ['provider', ...new Set(dimensions)] },
          affectedModels,
          affectedEndpoints,
          affectedParameters,
          affectedResources,
          apiOperationPatterns,
          ...(apiVersionMetadata ? { apiVersionMetadata } : {}),
          ...(replacement ? { replacement: { [replacement.kind === 'model' ? 'model' : replacement.kind === 'endpoint' ? 'endpoint' : replacement.kind === 'sdk_method' ? 'operation' : 'service']: replacement.value } } : {}),
          ...(change.dates.announced ? { publishedAt: change.dates.announced } : {}),
          ...(change.dates.effective ? { removalAt: change.dates.effective } : {}),
          sourceFacts: [change.evidence.excerpt],
          unknowns: ['Package, version range, and exact call-site scope require human review.'],
          severity: 'high',
        },
      } satisfies StructuredChange;
    }) };
  }
  if ([...DEDICATED_TIER_2_PROVIDERS, ...DEDICATED_TIER_3_PROVIDERS].includes(source.adapterId as DedicatedProvider)) {
    return { parserStatus: 'structured', changes: parseDedicatedProviderChangelog(source.adapterId as DedicatedProvider, body, { sourceUrl: source.sourceUrl }).changes.map((change) => {
      const identifiers = change.identifiers;
      const affectedEndpoints = identifiers.filter((item) => item.kind === 'endpoint').map((item) => item.value);
      const affectedParameters = identifiers.filter((item) => item.kind === 'parameter').map((item) => item.value);
      const affectedResources = identifiers.filter((item) => item.kind === 'service').map((item) => item.value);
      const apiVersion = identifiers.find((item) => item.kind === 'api_version')?.value;
      const apiVersionMetadata = apiVersion ? { version: apiVersion } : undefined;
      const replacement = change.replacement;
      const normalizedChangeType = change.changeType === 'sdk_method_removed' ? 'endpoint_removed' : change.changeType === 'service_deprecated' ? 'endpoint_removed' : change.changeType;
      const dimensions = identifiers.map((item) => item.kind === 'sdk_method' ? 'operation' : item.kind === 'service' ? 'resource' : item.kind);
      return {
        key: change.id,
        title: change.title,
        description: change.evidence.excerpt,
        sourceLocator: `${source.sourceUrl}#${change.evidence.locator}`,
        payload: {
          changeId: change.id,
          title: change.title,
          sourceTitle: `${source.displayName} official change source`,
          description: change.evidence.excerpt,
          changeType: normalizedChangeType,
          applicabilityScope: { dimensions: ['provider', ...new Set(dimensions)] },
          affectedModels: [],
          affectedEndpoints,
          affectedParameters,
          affectedResources,
          apiOperationPatterns: identifiers.filter((item) => item.kind === 'sdk_method').map((item) => item.value),
          ...(apiVersionMetadata ? { apiVersionMetadata } : {}),
          ...(replacement ? { replacement: { [replacement.kind === 'endpoint' ? 'endpoint' : replacement.kind === 'sdk_method' ? 'operation' : replacement.kind === 'service' ? 'service' : replacement.kind]: replacement.value } } : {}),
          ...(change.dates.effective ? { removalAt: change.dates.effective } : {}),
          sourceFacts: [change.evidence.excerpt],
          unknowns: ['Package, version range, and exact call-site scope require human review.'],
          severity: 'high',
        },
      } satisfies StructuredChange;
    }) };
  }
  if (source.adapterId === 'openai') return { parserStatus: 'structured', changes: parseOpenAiDeprecations(source, body) };
  return { parserStatus: 'structured', changes: parseHighConfidenceProviderChanges(source, body) };
}

/**
 * Parses a captured provider document without network or database side effects.
 * This is used by deterministic tests and replay tooling; persistence remains
 * owned by refreshProviderChangelog().
 */
export function parseProviderChangelogBody(providerId: string, body: string): { changes: readonly StructuredChange[]; parserStatus: ParserStatus } {
  const source = sourceByProvider.get(providerId);
  if (!source) throw new Error(`UNKNOWN_PROVIDER_SOURCE:${providerId}`);
  return parseStructuredChanges(source, body);
}

async function ensureSource(source: ProviderChangeSource, now: string): Promise<SourceRow> {
  const db = getDatabase();
  await db.execute(`
    INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at, next_attempt_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (source_url) DO NOTHING
  `, [source.id, source.providerId, source.sourceUrl, source.sourceType, source.adapterId, now, now, now]);
  const row = await db.queryOne<SourceRow>('SELECT id, content_hash, etag, last_modified FROM provider_change_sources WHERE source_url = ?', [source.sourceUrl]);
  if (!row) throw new Error('SOURCE_ROW_NOT_CREATED');
  return row;
}

export async function refreshProviderChangelog(providerId: string, options: ProviderChangelogRefreshOptions = {}): Promise<ProviderChangelogRefreshResult> {
  const source = sourceByProvider.get(providerId);
  if (!source) throw new Error(`UNKNOWN_PROVIDER_SOURCE:${providerId}`);
  const nowDate = options.now?.() ?? new Date();
  const now = nowDate.toISOString();
  const db = getDatabase();
  const row = await ensureSource(source, now);
  try {
    const fetched = await fetchOfficialSource(source, row, options);
    if (fetched.status === 304) {
      await db.execute('UPDATE provider_change_sources SET last_fetched_at = ?, next_attempt_at = ?, updated_at = ?, last_error_code = NULL WHERE id = ?', [now, nextAttempt(nowDate), now, row.id]);
      return { providerId, sourceUrl: source.sourceUrl, status: 'unchanged' };
    }
    const contentHash = sha256(fetched.body);
    const firstSnapshot = !row.content_hash;
    const changed = Boolean(row.content_hash && row.content_hash !== contentHash);
    let entryId: string | undefined;
    let candidateId: string | undefined;
    const entryIds: string[] = [];
    let rescansQueued = 0;
    let repositoryRescansQueued = 0;
    const parsed = parseStructuredChanges(source, fetched.body);
    const structuredChanges = parsed.changes;
    const parserStatus: ParserStatus = structuredChanges.length > 0 ? parsed.parserStatus : 'review-only';
    if (firstSnapshot || changed) {
      const changes = structuredChanges.length > 0 ? structuredChanges : [{
        key: 'official-document',
        title: `${source.displayName} official source snapshot`,
        description: sourceDescription(source, contentHash, firstSnapshot),
        sourceLocator: source.sourceUrl,
        payload: {
          changeId: `${source.providerId}-official-source-${contentHash.slice(0, 24)}`,
          title: `${source.displayName} official source update`,
          sourceTitle: `${source.displayName} official source`,
          description: sourceDescription(source, contentHash, false),
          sourceFacts: [`Official source changed at ${now}.`, `Content fingerprint: ${contentHash}.`],
          unknowns: ['Exact affected API surface requires human review.'],
          parserStatus,
          severity: 'high',
        },
      }];
      await db.transaction(async (tx) => {
        for (const change of changes) {
          const currentEntryId = `pce_${sha256(`${source.id}:${change.key}:${contentHash}`).slice(0, 32)}`;
          entryId ??= currentEntryId;
          entryIds.push(currentEntryId);
          await tx.execute(`
            INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (source_id, entry_key, content_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at
          `, [currentEntryId, source.id, source.providerId, change.key, change.title, change.description, change.sourceLocator, source.sourceUrl, contentHash, JSON.stringify({ providerId: source.providerId, sourceUrl: source.sourceUrl, contentHash, fetchedAt: now, parser: source.adapterId, parserStatus }), now, now]);
          if (changed) {
            // Candidate fingerprints are globally unique in the database. Bind
            // the payload to its provider and authoritative source so two
            // independent providers cannot suppress one another merely because
            // their normalized change payloads happen to be identical.
            const fingerprint = sha256(JSON.stringify({
              providerId: source.providerId,
              sourceUrl: source.sourceUrl,
              payload: change.payload,
            }));
            // Older deployments fingerprinted only the normalized payload.
            // Keep those rows discoverable during the rollout so a source
            // refresh cannot create a duplicate candidate for an already
            // reviewed change. Scope the fallback by provider because the
            // legacy fingerprint was globally unique and could otherwise
            // suppress an unrelated provider's candidate.
            const legacyFingerprint = sha256(JSON.stringify(change.payload));
            const existingCandidate = await tx.queryOne<{ id: string }>(`
              SELECT id
              FROM provider_rule_candidates
              WHERE provider_id = ?
                AND candidate_fingerprint IN (?, ?)
              LIMIT 1
            `, [source.providerId, fingerprint, legacyFingerprint]);
            if (existingCandidate) {
              candidateId ??= existingCandidate.id;
              continue;
            }
            const currentCandidateId = `prc_${sha256(`${source.providerId}:${source.sourceUrl}:${change.key}:${contentHash}`).slice(0, 32)}`;
            candidateId ??= currentCandidateId;
            await tx.execute(`
              INSERT INTO provider_rule_candidates (id, changelog_entry_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'needs_review', 'high', ?, ?, ?)
              ON CONFLICT (candidate_fingerprint) DO NOTHING
            `, [currentCandidateId, currentEntryId, source.providerId, fingerprint, JSON.stringify(change.payload), now, now]);
          }
        }
        if (changed) {
          await enqueueProviderChangeSlackNotifications(entryIds, tx);
          rescansQueued = await enqueueProviderSourceChangeRescans(tx, source.providerId, now);
          repositoryRescansQueued = await enqueueRepositoryProviderSourceChangeRescans(tx, source.providerId, now);
        }
        await tx.execute('UPDATE provider_change_sources SET content_hash = ?, etag = ?, last_modified = ?, last_fetched_at = ?, last_success_at = ?, next_attempt_at = ?, failure_count = 0, last_error_code = NULL, last_error_at = NULL, updated_at = ? WHERE id = ?', [contentHash, fetched.etag, fetched.lastModified, now, now, nextAttempt(nowDate), now, row.id]);
      });
    } else {
      await db.execute('UPDATE provider_change_sources SET last_fetched_at = ?, last_success_at = ?, next_attempt_at = ?, failure_count = 0, last_error_code = NULL, last_error_at = NULL, updated_at = ? WHERE id = ?', [now, now, nextAttempt(nowDate), now, row.id]);
    }
    const result: ProviderChangelogRefreshResult = { providerId, sourceUrl: source.sourceUrl, status: firstSnapshot ? 'baseline' : changed ? 'changed' : 'unchanged', detectedChanges: structuredChanges.length, parserStatus };
    if (entryId) result.entryId = entryId;
    if (candidateId) result.candidateId = candidateId;
    if (rescansQueued > 0) result.rescansQueued = rescansQueued;
    if (repositoryRescansQueued > 0) result.repositoryRescansQueued = repositoryRescansQueued;
    return result;
  } catch (error) {
    const errorCode = error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message) ? error.message : 'SOURCE_REFRESH_FAILED';
    await db.execute('UPDATE provider_change_sources SET last_fetched_at = ?, next_attempt_at = ?, failure_count = failure_count + 1, last_error_code = ?, last_error_at = ?, updated_at = ? WHERE id = ?', [now, nextAttempt(nowDate), errorCode, now, now, row.id]);
    return { providerId, sourceUrl: source.sourceUrl, status: 'failed', errorCode };
  }
}

export async function refreshAllProviderChangelogs(options: ProviderChangelogRefreshOptions = {}): Promise<ProviderChangelogRefreshResult[]> {
  const results: ProviderChangelogRefreshResult[] = [];
  const queue = [...PROVIDER_CHANGE_SOURCES];
  const now = options.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const sourceRows = await getDatabase().query<{ provider_id: string; next_attempt_at: string | null }>(
    'SELECT provider_id, next_attempt_at FROM provider_change_sources WHERE enabled = 1',
  );
  const nextAttemptByProvider = new Map(sourceRows.map((row) => [row.provider_id, row.next_attempt_at]));
  const due = queue.filter((source) => {
    const nextAttemptAt = nextAttemptByProvider.get(source.providerId);
    if (!nextAttemptAt || nextAttemptAt <= nowIso) return true;
    results.push({ providerId: source.providerId, sourceUrl: source.sourceUrl, status: 'skipped', skipReason: 'not_due', nextAttemptAt });
    return false;
  });
  // SQLite is the local/test adapter and serializes writes; Postgres can use
  // bounded parallelism without turning one refresh into a lock storm.
  const concurrency = getDatabase().engine === 'sqlite' ? 1 : 3;
  const worker = async (): Promise<void> => {
    while (due.length > 0) {
      const source = due.shift();
      if (source) results.push(await refreshProviderChangelog(source.providerId, options));
      else break;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, () => worker()));
  return results.sort((a, b) => a.providerId.localeCompare(b.providerId, 'en'));
}

export function getProviderChangeSource(providerId: string): ProviderChangeSource | undefined {
  return sourceByProvider.get(providerId);
}
