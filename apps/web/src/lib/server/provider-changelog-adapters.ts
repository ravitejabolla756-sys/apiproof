import { createHash } from 'node:crypto';

export const TIER_1_PROVIDERS = ['stripe', 'twilio', 'firebase', 'github', 'aws', 'openai'] as const;
export type Tier1Provider = (typeof TIER_1_PROVIDERS)[number];

/** Providers with source-specific parsing beyond the profiled fallback. */
export const DEDICATED_TIER_2_PROVIDERS = ['google-cloud', 'slack', 'sendgrid', 'shopify', 'auth0', 'clerk'] as const;
export type DedicatedTier2Provider = (typeof DEDICATED_TIER_2_PROVIDERS)[number];
export const DEDICATED_TIER_3_PROVIDERS = ['supabase', 'vercel', 'cloudflare', 'launchdarkly', 'elevenlabs', 'groq', 'braintree'] as const;
export type DedicatedTier3Provider = (typeof DEDICATED_TIER_3_PROVIDERS)[number];
export type DedicatedProvider = DedicatedTier2Provider | DedicatedTier3Provider;

/** Narrow provider-specific hints for sources that still require human review. */
export type ProfiledProvider =
  | 'google-cloud' | 'slack' | 'sendgrid' | 'shopify' | 'auth0' | 'clerk'
  | 'supabase' | 'vercel' | 'cloudflare' | 'launchdarkly' | 'elevenlabs'
  | 'groq' | 'braintree';

export type LaunchProvider = Tier1Provider | ProfiledProvider;

export type ProviderChangelogProfile = {
  readonly providerId: ProfiledProvider;
  readonly identifierPatterns: readonly RegExp[];
  readonly identifierKind: 'operation' | 'endpoint' | 'model' | 'service' | 'api_version';
};

export const PROFILED_PROVIDER_CHANGELOGS: readonly ProviderChangelogProfile[] = [
  { providerId: 'google-cloud', identifierKind: 'service', identifierPatterns: [/\bcom\.google\.cloud:[A-Za-z0-9_.-]+\b/i, /\bgoogle\.[A-Za-z0-9_.-]+\b/i] },
  { providerId: 'slack', identifierKind: 'operation', identifierPatterns: [/\b(?:chat|conversations|files|oauth|events|views)\.[A-Za-z0-9_.-]+\b/i] },
  { providerId: 'sendgrid', identifierKind: 'endpoint', identifierPatterns: [/\b(?:mail\/send|contacts|marketing|templates|v3\/[A-Za-z0-9_/.~-]+)\b/i] },
  // Prefer the concrete version token over the product label when both occur
  // in a release-note sentence.
  { providerId: 'shopify', identifierKind: 'api_version', identifierPatterns: [/\b20\d{2}-\d{2}\b/, /\b(?:Admin|Storefront) API\b/i] },
  { providerId: 'auth0', identifierKind: 'endpoint', identifierPatterns: [/(?:\/api\/v2|\/oauth\/token|\/userinfo)\b/i, /\bUniversal Login\b/i] },
  { providerId: 'clerk', identifierKind: 'operation', identifierPatterns: [/\b(?:Backend API|Frontend API|BAPI)\b/i, /\bclerk\.[A-Za-z0-9_.-]+\b/i] },
  { providerId: 'supabase', identifierKind: 'service', identifierPatterns: [/\b(?:PostgREST|Realtime|Storage|Edge Functions)\b/i, /\b(?:supabase|pg_graphql)\.[A-Za-z0-9_.-]+\b/i] },
  { providerId: 'vercel', identifierKind: 'endpoint', identifierPatterns: [/(?:\/v\d+\/projects|\/v\d+\/deployments|Edge Runtime|Functions)\b/i] },
  { providerId: 'cloudflare', identifierKind: 'service', identifierPatterns: [/\b(?:Workers|R2|KV|D1|Durable Objects)\b/i, /\bapi\.cloudflare\.com\b/i] },
  { providerId: 'launchdarkly', identifierKind: 'endpoint', identifierPatterns: [/\b(?:flag|flags|segments|environments|projects)\b/i, /\bapi\.launchdarkly\.com\b/i] },
  { providerId: 'elevenlabs', identifierKind: 'operation', identifierPatterns: [/\b(?:text-to-speech|speech-to-text|voice|voices|models)\b/i, /\bapi\.elevenlabs\.io\b/i] },
  { providerId: 'groq', identifierKind: 'operation', identifierPatterns: [/\b(?:chat\.completions|audio\.transcriptions|models)\b/i, /\bapi\.groq\.com\b/i] },
  { providerId: 'braintree', identifierKind: 'operation', identifierPatterns: [/\b(?:transaction|customer|payment method|vault)\b/i, /\bapi\.braintreegateway\.com\b/i] },
];

const profiledProviderById = new Map(PROFILED_PROVIDER_CHANGELOGS.map((profile) => [profile.providerId, profile]));

export function getProviderChangelogProfile(provider: string): ProviderChangelogProfile | undefined {
  return profiledProviderById.get(provider as ProfiledProvider);
}

export const TIER_1_SOURCE_URLS: Readonly<Record<Tier1Provider, string>> = {
  stripe: 'https://stripe.com/docs/upgrades',
  twilio: 'https://www.twilio.com/en-us/changelog',
  firebase: 'https://firebase.google.com/support/release-notes/js',
  github: 'https://docs.github.com/en/rest/overview/api-versions',
  aws: 'https://docs.aws.amazon.com/sdk-for-javascript/latest/developer-guide/breaking-changes.html',
  openai: 'https://developers.openai.com/api/docs/deprecations',
};

export type ChangeIdentifierKind =
  | 'api_version'
  | 'endpoint'
  | 'parameter'
  | 'model'
  | 'sdk_method'
  | 'service';

export type ChangeIdentifier = {
  readonly kind: ChangeIdentifierKind;
  readonly value: string;
};

export type ProviderChangeType =
  | 'api_version_retired'
  | 'endpoint_removed'
  | 'parameter_removed'
  | 'model_retired'
  | 'sdk_method_removed'
  | 'service_deprecated';

export type ProviderChangelogChange = {
  readonly id: string;
  readonly provider: LaunchProvider;
  readonly title: string;
  readonly changeType: ProviderChangeType;
  readonly identifiers: readonly ChangeIdentifier[];
  readonly dates: {
    readonly announced?: string;
    readonly effective?: string;
  };
  readonly replacement?: ChangeIdentifier;
  readonly evidence: {
    readonly sourceUrl: string;
    readonly excerpt: string;
    readonly locator: string;
  };
};

export type ParserRejection = {
  readonly provider: LaunchProvider;
  readonly reason: 'missing_identifier' | 'unsupported_change' | 'invalid_date' | 'contradictory_evidence';
  readonly excerpt: string;
  readonly locator: string;
};

export type ProviderChangelogParseResult = {
  readonly provider: LaunchProvider;
  readonly changes: readonly ProviderChangelogChange[];
  readonly rejected: readonly ParserRejection[];
};

export type ProviderChangelogParseOptions = {
  readonly sourceUrl?: string;
};

type Candidate = {
  readonly changeType: ProviderChangeType;
  readonly identifiers: readonly ChangeIdentifier[];
  readonly date?: string;
  readonly replacement?: ChangeIdentifier;
};

type ParseDecision =
  | { readonly kind: 'change'; readonly candidate: Candidate }
  | { readonly kind: 'reject'; readonly reason: ParserRejection['reason'] };

const LIFECYCLE_RE = /\b(?:breaking change|deprecated|deprecation|sunset|retired|retirement|removed|removal|shutdown|end[- ]of[- ]support|no longer supported|will be removed)\b/i;
const SEMANTIC_CHANGE_RE = /\b(?:behavior|behaviour|semantics|meaning|contract)\b.{0,160}\bchanged\b|\bchange(?:d|s)?\s+in\s+(?:behavior|behaviour|semantics|meaning|contract)\b/i;
const CONTRADICTORY_SUPPORT_RE = /\b(?:not|never)\s+(?:being\s+)?(?:removed|deprecated|retired|sunset)|\b(?:removal|deprecation|retirement)\s+(?:was\s+)?cancelled\b|\b(?:remains?|continues?)\s+(?:fully\s+)?supported\b/i;
const DATE_RE = /\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2})\b/i;
const CODE_RE = /`([^`]+)`/g;
const ENDPOINT_RE = /(?<![@A-Za-z0-9_.-])\/(?:v\d+(?:\.\d+)?\/)?[A-Za-z0-9_.:{}-]+(?:\/[A-Za-z0-9_.:{}-]+){0,8}/g;
const MODEL_RE = /\b(?:gpt-[A-Za-z0-9.-]+|o[1-9][A-Za-z0-9.-]*|text-(?:embedding|moderation)-[A-Za-z0-9.-]+|davinci(?:-[A-Za-z0-9.-]+)?|curie(?:-[A-Za-z0-9.-]+)?|babbage(?:-[A-Za-z0-9.-]+)?|ada(?:-[A-Za-z0-9.-]+)?)\b/gi;

const MONTHS: Readonly<Record<string, string>> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&#x2F;|&#47;/gi, '/')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function normalizeWhitespace(value: string): string {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function toTextBlocks(input: string): readonly string[] {
  const marker = '\u0000';
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, marker)
    .replace(/<\s*code\b[^>]*>(.*?)<\s*\/\s*code\s*>/gis, '`$1`')
    .replace(/<\s*\/(?:article|div|li|section|tr)\s*>/gi, marker)
    .replace(/<[^>]*>/g, ' ');
  const hasMarkup = /<[^>]+>/.test(input);
  const blocks = hasMarkup ? withBreaks.split(marker) : withBreaks.split(/\r?\n+/);
  return blocks
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().replace(/,/g, '');
  const iso = value.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    if (!year || !month || !day) return undefined;
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isValidIsoDate(normalized) ? normalized : undefined;
  }
  const monthName = value.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(20\d{2})$/);
  if (!monthName) return undefined;
  const [, monthNameValue, day, year] = monthName;
  const month = monthNameValue ? MONTHS[monthNameValue.toLowerCase()] : undefined;
  if (!month || !day || !year) return undefined;
  const normalized = `${year}-${month}-${day.padStart(2, '0')}`;
  return isValidIsoDate(normalized) ? normalized : undefined;
}

function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function codeTokens(block: string): readonly string[] {
  return [...block.matchAll(CODE_RE)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160);
}

function endpointTokens(block: string): readonly string[] {
  return [...block.matchAll(ENDPOINT_RE)]
    .map((match) => match[0])
    .filter((value, index, values) => values.indexOf(value) === index);
}

function modelTokens(block: string): readonly string[] {
  return [...block.matchAll(MODEL_RE)]
    .map((match) => match[0])
    .filter((value, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index);
}

function apiVersionToken(block: string): string | undefined {
  const match = block.match(/\b(?:api\s*)?version\s+(v?20\d{2}[-/]\d{1,2}[-/]\d{1,2}|v?\d+(?:\.\d+)?)\b/i);
  return match?.[1]?.replace(/\//g, '-');
}

function parameterToken(block: string): string | undefined {
  const match = block.match(/\b(?:parameter|field|argument|property)\s+["'`]?([A-Za-z][A-Za-z0-9_.-]{1,100})["'`]?/i);
  return match?.[1];
}

function methodToken(block: string): string | undefined {
  const token = codeTokens(block).find((value) => /(?:\.|::)[A-Za-z_$][\w$]*(?:\(\))?$/.test(value));
  return token?.replace(/\(\)$/, '');
}

function uniqueIdentifiers(values: readonly (ChangeIdentifier | undefined)[]): readonly ChangeIdentifier[] {
  const result: ChangeIdentifier[] = [];
  for (const value of values) {
    if (!value || result.some((existing) => existing.kind === value.kind && existing.value === value.value)) continue;
    result.push(value);
  }
  return result;
}

function identifier(kind: ChangeIdentifierKind, value: string | undefined): ChangeIdentifier | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 160 || /^https?:\/\//i.test(normalized)) return undefined;
  return { kind, value: normalized };
}

function replacementToken(block: string, identifiers: readonly ChangeIdentifier[]): ChangeIdentifier | undefined {
  const replacementSection = block.match(/\b(?:replacement|alternative|migrate\s+to|use)\b\s*[:-]?\s*(.*)$/i)?.[1];
  if (!replacementSection) return undefined;
  const excluded = new Set(identifiers.map((item) => item.value.toLowerCase()));
  const candidates = [...codeTokens(replacementSection), ...endpointTokens(replacementSection), ...modelTokens(replacementSection)];
  const value = candidates.find((candidate) => !excluded.has(candidate.toLowerCase()));
  if (!value) return undefined;
  const kind: ChangeIdentifierKind = value.startsWith('/') ? 'endpoint' : /^(?:gpt-|o[1-9]|text-(?:embedding|moderation)-|davinci|curie|babbage|ada)/i.test(value) ? 'model' : 'sdk_method';
  return identifier(kind, value);
}

function sourceResult(provider: LaunchProvider, input: string, options: ProviderChangelogParseOptions, decide: (block: string) => ParseDecision, qualifies: (block: string) => boolean = (block) => LIFECYCLE_RE.test(block)): ProviderChangelogParseResult {
  const sourceUrl = options.sourceUrl ?? TIER_1_SOURCE_URLS[provider as Tier1Provider] ?? `https://example.invalid/${provider}/changelog`;
  const changes: ProviderChangelogChange[] = [];
  const rejected: ParserRejection[] = [];
  const seen = new Set<string>();
  for (const [index, block] of toTextBlocks(input).entries()) {
    if (!qualifies(block) && !SEMANTIC_CHANGE_RE.test(block)) continue;
    const locator = `entry-${index + 1}`;
    if (CONTRADICTORY_SUPPORT_RE.test(block) && LIFECYCLE_RE.test(block)) {
      rejected.push({ provider, reason: 'contradictory_evidence', excerpt: block.slice(0, 500), locator });
      continue;
    }
    if (SEMANTIC_CHANGE_RE.test(block)) {
      rejected.push({ provider, reason: 'unsupported_change', excerpt: block.slice(0, 500), locator });
      continue;
    }
    const decision = decide(block);
    if (decision.kind === 'reject') {
      rejected.push({ provider, reason: decision.reason, excerpt: block.slice(0, 500), locator });
      continue;
    }
    const { candidate } = decision;
    const effectiveDate = candidate.date;
    const primary = candidate.identifiers[0];
    if (!primary) {
      rejected.push({ provider, reason: 'missing_identifier', excerpt: block.slice(0, 500), locator });
      continue;
    }
    const fingerprint = [provider, candidate.changeType, ...candidate.identifiers.map((item) => `${item.kind}:${item.value}`), effectiveDate ?? '', candidate.replacement?.value ?? ''].join('|');
    const id = `${provider}_change_${createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const title = `${provider} ${candidate.changeType.replaceAll('_', ' ')}: ${primary.value}`;
    changes.push({
      id,
      provider,
      title,
      changeType: candidate.changeType,
      identifiers: candidate.identifiers,
      dates: effectiveDate ? { effective: effectiveDate } : {},
      ...(candidate.replacement ? { replacement: candidate.replacement } : {}),
      evidence: { sourceUrl, excerpt: block.slice(0, 1_000), locator },
    });
  }
  return { provider, changes, rejected };
}

function lifecycleDecision(changeType: ProviderChangeType, identifiers: readonly ChangeIdentifier[], block: string): ParseDecision {
  if (identifiers.length === 0) return { kind: 'reject', reason: 'missing_identifier' };
  const rawDate = block.match(DATE_RE)?.[0];
  const date = rawDate ? normalizeDate(rawDate) : undefined;
  if (rawDate && !date) return { kind: 'reject', reason: 'invalid_date' };
  const replacement = replacementToken(block, identifiers);
  return { kind: 'change', candidate: { changeType, identifiers, ...(date ? { date } : {}), ...(replacement ? { replacement } : {}) } };
}

function parseStripeBlock(block: string): ParseDecision {
  const version = identifier('api_version', apiVersionToken(block));
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const parameter = identifier('parameter', parameterToken(block));
  const method = identifier('sdk_method', methodToken(block));
  if (endpoint) return lifecycleDecision('endpoint_removed', uniqueIdentifiers([version, endpoint]), block);
  if (parameter) return lifecycleDecision('parameter_removed', uniqueIdentifiers([version, parameter]), block);
  if (version) return lifecycleDecision('api_version_retired', [version], block);
  if (method) return lifecycleDecision('sdk_method_removed', [method], block);
  return { kind: 'reject', reason: 'missing_identifier' };
}

function parseTwilioBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const version = identifier('api_version', apiVersionToken(block));
  const method = identifier('sdk_method', methodToken(block));
  const service = identifier('service', block.match(/\b(?:Messaging|SMS|Voice|WhatsApp|Verify|Conversations|Twilio)\s+API\b/i)?.[0]);
  return lifecycleDecision(endpoint ? 'endpoint_removed' : method ? 'sdk_method_removed' : 'service_deprecated', uniqueIdentifiers([endpoint, version, method, service]), block);
}

function parseFirebaseBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const parameter = identifier('parameter', parameterToken(block));
  const method = identifier('sdk_method', methodToken(block));
  const packageName = identifier('service', codeTokens(block).find((value) => /^@?firebase(?:[-/][A-Za-z0-9_-]+)?$/i.test(value)));
  const service = packageName ?? identifier('service', block.match(/\bFirebase\s+(?:JS\s+)?SDK\b/i)?.[0]);
  return lifecycleDecision(endpoint ? 'endpoint_removed' : parameter ? 'parameter_removed' : method ? 'sdk_method_removed' : 'service_deprecated', uniqueIdentifiers([endpoint, parameter, method, service]), block);
}

function parseGitHubBlock(block: string): ParseDecision {
  const version = identifier('api_version', apiVersionToken(block) ?? block.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0]);
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  return lifecycleDecision(endpoint ? 'endpoint_removed' : 'api_version_retired', uniqueIdentifiers([version, endpoint]), block);
}

function parseAwsBlock(block: string): ParseDecision {
  const method = identifier('sdk_method', methodToken(block));
  const service = identifier('service', block.match(/\b(?:AWS SDK for JavaScript(?:\s+v[12])?|Amazon\s+[A-Z][A-Za-z]+|S3|DynamoDB|Lambda|CloudWatch)\b/i)?.[0]);
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  return lifecycleDecision(method ? 'sdk_method_removed' : endpoint ? 'endpoint_removed' : 'service_deprecated', uniqueIdentifiers([service, method, endpoint]), block);
}

function parseOpenAiBlock(block: string): ParseDecision {
  const modelValues = [...modelTokens(block), ...codeTokens(block).filter((value) => /^[A-Za-z0-9][A-Za-z0-9_.:-]{1,150}$/.test(value))];
  const models = uniqueIdentifiers(modelValues.map((value) => identifier('model', value)));
  const primary = models[0];
  if (!primary) return { kind: 'reject', reason: 'missing_identifier' };
  const replacementSection = models.length > 1 ? models[models.length - 1] : block.match(/\b(?:recommended\s+)?replacement|alternative|migrate\s+to\b/i) ? replacementToken(block, models) : undefined;
  const identifiers = replacementSection ? models.filter((item) => item.value !== replacementSection.value) : models;
  const date = normalizeDate(block.match(DATE_RE)?.[0]);
  return lifecycleDecision('model_retired', identifiers, block).kind === 'change'
    ? { kind: 'change', candidate: { changeType: 'model_retired', identifiers, ...(date ? { date } : {}), ...(replacementSection ? { replacement: replacementSection } : {}) } }
    : lifecycleDecision('model_retired', identifiers, block);
}

function parseGoogleCloudBlock(block: string): ParseDecision {
  const service = identifier('service', codeTokens(block).find((value) => /^(?:com\.google\.cloud:|google\.)/i.test(value))
    ?? block.match(/\b(?:API Registry|MCP|Cloud [A-Z][A-Za-z]+|Google Cloud [A-Z][A-Za-z]+)\b/i)?.[0]);
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const method = identifier('sdk_method', codeTokens(block).find((value) => /\.(?:list|get|create|delete|update|call)$/i.test(value)));
  return lifecycleDecision(endpoint ? 'endpoint_removed' : method ? 'sdk_method_removed' : 'service_deprecated', uniqueIdentifiers([endpoint, method, service]), block);
}

function parseSlackBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const operation = identifier('sdk_method', codeTokens(block).find((value) => /^(?:chat|conversations|files|oauth|events|views)\.[A-Za-z0-9_.-]+$/i.test(value))
    ?? block.match(/\b(?:chat|conversations|files|oauth|events|views)\.[A-Za-z0-9_.-]+\b/i)?.[0]);
  return lifecycleDecision(endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, operation]), block);
}

function parseSendGridBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0] ?? block.match(/\b(?:mail\/send|contacts|marketing|templates|v3\/[A-Za-z0-9_/.~-]+)\b/i)?.[0]);
  const method = identifier('sdk_method', codeTokens(block).find((value) => /(?:sendgrid|mail\.send|client\.send)/i.test(value)));
  return lifecycleDecision(endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, method]), block);
}

function parseShopifyBlock(block: string): ParseDecision {
  const apiVersionMatch = block.match(/\b(?:api\s+version|version)\s+[`']?(20\d{2}-\d{2})\b/i)
    ?? block.match(/[`'](20\d{2}-\d{2})[`']\s+(?:(?:Admin|Storefront)\s+)?API\s+version/i);
  const apiVersion = identifier('api_version', apiVersionMatch?.[1]);
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const method = identifier('sdk_method', codeTokens(block).find((value) => /shopify|graphql|admin/i.test(value)));
  return lifecycleDecision(apiVersion ? 'api_version_retired' : endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([apiVersion, endpoint, method]), block);
}

function parseAuth0Block(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0] ?? block.match(/\/(?:api\/v2|oauth\/token|userinfo)\b/i)?.[0]);
  const parameter = identifier('parameter', parameterToken(block));
  const method = identifier('sdk_method', codeTokens(block).find((value) => /auth0|universal.?login/i.test(value)));
  return lifecycleDecision(parameter ? 'parameter_removed' : endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, parameter, method]), block);
}

function parseClerkBlock(block: string): ParseDecision {
  const operation = identifier('sdk_method', codeTokens(block).find((value) => /^(?:clerk\.|Backend API|Frontend API|BAPI)/i.test(value))
    ?? block.match(/\b(?:Backend API|Frontend API|BAPI)\b/i)?.[0]);
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const parameter = identifier('parameter', parameterToken(block));
  return lifecycleDecision(parameter ? 'parameter_removed' : endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, parameter, operation]), block);
}

function parseSupabaseBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0] ?? block.match(/\b(?:logs\.all|analytics\/endpoints\/logs|rest\/v1\/[A-Za-z0-9_.-]+)\b/i)?.[0]);
  const service = identifier('service', block.match(/\b(?:PostgREST|Realtime|Storage|Edge Functions|pg_graphql)\b/i)?.[0]);
  const method = identifier('sdk_method', codeTokens(block).find((value) => /supabase|\.from\(|\.rpc\(/i.test(value)));
  return lifecycleDecision(endpoint ? 'endpoint_removed' : method ? 'sdk_method_removed' : 'service_deprecated', uniqueIdentifiers([endpoint, method, service]), block);
}

function parseVercelBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0] ?? block.match(/\/(?:v\d+\/)?(?:projects|deployments|webhooks)\b[^\s<]*/i)?.[0]);
  const service = identifier('service', block.match(/\b(?:Edge Runtime|Functions|Webhooks|Integrations)\b/i)?.[0]);
  const method = identifier('sdk_method', codeTokens(block).find((value) => /vercel|webhook|deployment/i.test(value)));
  return lifecycleDecision(endpoint ? 'endpoint_removed' : method ? 'sdk_method_removed' : 'service_deprecated', uniqueIdentifiers([endpoint, method, service]), block);
}

function parseCloudflareBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const service = identifier('service', codeTokens(block).find((value) => /^(?:Workers|R2|KV|D1|Durable Objects)$/i.test(value))
    ?? block.match(/\b(?:Workers|R2|KV|D1|Durable Objects|api\.cloudflare\.com)\b/i)?.[0]);
  const method = identifier('sdk_method', codeTokens(block).find((value) => /cloudflare|namespace/i.test(value)));
  return lifecycleDecision(endpoint ? 'endpoint_removed' : method ? 'sdk_method_removed' : 'service_deprecated', uniqueIdentifiers([endpoint, method, service]), block);
}

function parseLaunchDarklyBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0] ?? block.match(/\b(?:api\.launchdarkly\.com|flags?|segments?|environments?|projects?)\b/i)?.[0]);
  const parameter = identifier('parameter', parameterToken(block));
  const method = endpoint || parameter ? undefined : identifier('sdk_method', codeTokens(block).find((value) => /launchdarkly|flag|segment/i.test(value)));
  return lifecycleDecision(parameter ? 'parameter_removed' : endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, parameter, method]), block);
}

function parseElevenLabsBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const operation = identifier('sdk_method', codeTokens(block).find((value) => /^(?:text-to-speech|speech-to-text|voice|voices|models)$/i.test(value))
    ?? block.match(/\b(?:text-to-speech|speech-to-text|voice|voices|models)\b/i)?.[0]);
  return lifecycleDecision(endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, operation]), block);
}

function parseGroqBlock(block: string): ParseDecision {
  const model = identifier('model', codeTokens(block).find((value) => /^(?:llama|mixtral|gemma|qwen|deepseek)[A-Za-z0-9_.:-]*$/i.test(value)));
  const operation = identifier('sdk_method', codeTokens(block).find((value) => /^(?:chat\.completions|audio\.transcriptions|models)$/i.test(value))
    ?? block.match(/\b(?:chat\.completions|audio\.transcriptions|models)\b/i)?.[0]);
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  return lifecycleDecision(model ? 'model_retired' : endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([model, endpoint, operation]), block);
}

function parseBraintreeBlock(block: string): ParseDecision {
  const endpoint = identifier('endpoint', endpointTokens(block)[0]);
  const operation = identifier('sdk_method', codeTokens(block).find((value) => /^(?:transaction|customer|payment|vault|drop-in|transparent-redirect)$/i.test(value))
    ?? block.match(/\b(?:transaction|customer|payment method|vault|Drop-in|Transparent Redirect)\b/i)?.[0]);
  return lifecycleDecision(endpoint ? 'endpoint_removed' : 'sdk_method_removed', uniqueIdentifiers([endpoint, operation]), block);
}

export function parseStripeChangelog(input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  return sourceResult('stripe', input, options, parseStripeBlock);
}

export function parseTwilioChangelog(input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  return sourceResult('twilio', input, options, parseTwilioBlock);
}

export function parseFirebaseChangelog(input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  return sourceResult('firebase', input, options, parseFirebaseBlock);
}

export function parseGitHubChangelog(input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  return sourceResult('github', input, options, parseGitHubBlock);
}

export function parseAwsChangelog(input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  return sourceResult('aws', input, options, parseAwsBlock);
}

export function parseOpenAiChangelog(input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  return sourceResult('openai', input, options, parseOpenAiBlock, (block) => LIFECYCLE_RE.test(block) || (Boolean(block.match(DATE_RE)) && (modelTokens(block).length > 0 || codeTokens(block).length > 0)));
}

export function parseDedicatedTier2ProviderChangelog(provider: DedicatedTier2Provider, input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  const parsers: Record<DedicatedTier2Provider, (block: string) => ParseDecision> = {
    'google-cloud': parseGoogleCloudBlock,
    slack: parseSlackBlock,
    sendgrid: parseSendGridBlock,
    shopify: parseShopifyBlock,
    auth0: parseAuth0Block,
    clerk: parseClerkBlock,
  };
  return sourceResult(provider, input, options, parsers[provider]);
}

export function parseDedicatedProviderChangelog(provider: DedicatedProvider, input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  if ((DEDICATED_TIER_2_PROVIDERS as readonly string[]).includes(provider)) {
    return parseDedicatedTier2ProviderChangelog(provider as DedicatedTier2Provider, input, options);
  }
  const parsers: Record<DedicatedTier3Provider, (block: string) => ParseDecision> = {
    supabase: parseSupabaseBlock,
    vercel: parseVercelBlock,
    cloudflare: parseCloudflareBlock,
    launchdarkly: parseLaunchDarklyBlock,
    elevenlabs: parseElevenLabsBlock,
    groq: parseGroqBlock,
    braintree: parseBraintreeBlock,
  };
  return sourceResult(provider as DedicatedTier3Provider, input, options, parsers[provider as DedicatedTier3Provider]);
}

export function parseTier1ProviderChangelog(provider: Tier1Provider, input: string, options: ProviderChangelogParseOptions = {}): ProviderChangelogParseResult {
  switch (provider) {
    case 'stripe': return parseStripeChangelog(input, options);
    case 'twilio': return parseTwilioChangelog(input, options);
    case 'firebase': return parseFirebaseChangelog(input, options);
    case 'github': return parseGitHubChangelog(input, options);
    case 'aws': return parseAwsChangelog(input, options);
    case 'openai': return parseOpenAiChangelog(input, options);
  }
}
