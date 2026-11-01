import process from 'node:process';

type PreflightStatus = {
  ok?: boolean;
  configuration?: { readyForLiveBeta?: boolean };
  runtime?: { productizationV1Enabled?: boolean; workerCommitSha?: string; workerVersion?: string; providerRegistryDigest?: string };
  sources?: unknown;
  queues?: Record<string, unknown>;
  generatedAt?: string;
};

const EXPECTED_MONITORED_PROVIDERS = [
  'stripe', 'twilio', 'openai', 'firebase', 'github', 'aws', 'google-cloud', 'slack',
  'sendgrid', 'shopify', 'auth0', 'clerk', 'supabase', 'vercel', 'cloudflare',
  'launchdarkly', 'elevenlabs', 'groq', 'braintree',
] as const;
const MAX_SOURCE_AGE_MS = 6 * 60 * 60 * 1000;

export type BetaLivePreflightResult = {
  baseUrl: string;
  status: 'pass' | 'fail';
  checks: Array<{ id: string; status: 'pass' | 'fail'; detail: string }>;
  observedAt: string;
  runtime?: {
    workerCommitSha?: string;
    workerVersion?: string;
    providerRegistryDigest?: string;
  };
};

function normalizedBaseUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('MY_OWL_BETA_BASE_URL must use HTTPS.');
  return url.toString().replace(/\/$/, '');
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export async function runBetaLivePreflight(
  baseUrl: string,
  cronSecret: string,
  fetchImpl: typeof fetch = fetch,
  expectedRegistryDigest?: string,
): Promise<BetaLivePreflightResult> {
  const normalizedUrl = normalizedBaseUrl(baseUrl);
  if (!cronSecret.trim()) throw new Error('CRON_SECRET is required but is never printed.');
  const observedAt = new Date().toISOString();
  const checks: BetaLivePreflightResult['checks'] = [];
  const response = await fetchImpl(`${normalizedUrl}/api/internal/provider-intelligence/status`, {
    method: 'GET',
    headers: { authorization: `Bearer ${cronSecret}` },
    redirect: 'error',
  });
  checks.push({
    id: 'authenticated-status-endpoint',
    status: response.status === 200 ? 'pass' : 'fail',
    detail: `status=${response.status}`,
  });
  const unauthorizedResponse = await fetchImpl(`${normalizedUrl}/api/internal/provider-intelligence/status`, {
    method: 'GET',
    redirect: 'error',
  });
  checks.push({
    id: 'unauthenticated-status-boundary',
    status: unauthorizedResponse.status === 401 ? 'pass' : 'fail',
    detail: `unauthenticated status=${unauthorizedResponse.status}`,
  });

  let payload: PreflightStatus | undefined;
  let statusJsonValid = false;
  try {
    payload = await response.json() as PreflightStatus;
    statusJsonValid = Boolean(payload && typeof payload === 'object' && !Array.isArray(payload));
  } catch {
    // Keep the initial false value; the response body was not JSON.
  }
  checks.push({
    id: 'status-json',
    status: statusJsonValid ? 'pass' : 'fail',
    detail: statusJsonValid ? 'Authenticated status response is valid JSON.' : `Authenticated status response was not valid JSON (status=${response.status}).`,
  });
  checks.push({
    id: 'status-contract',
    status: response.status === 200 && payload?.ok === true ? 'pass' : 'fail',
    detail: response.status === 200 && payload?.ok === true
      ? 'Authenticated provider-intelligence status contract is active.'
      : 'The deployed provider-intelligence status contract is missing, non-200, or did not report ok=true.',
  });
  checks.push({
    id: 'runtime-configuration',
    status: response.status === 200 && payload?.configuration?.readyForLiveBeta === true ? 'pass' : 'fail',
    detail: response.status === 200 && payload?.configuration?.readyForLiveBeta === true
      ? 'Required non-secret production configuration is present; live GitHub is enabled read-only.'
      : 'Database, application, cron, GitHub App, authorized installation/repository binding, webhook, HTTPS URL, and read-only live GitHub configuration must all be present.',
  });

  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  const providerIds = sources.map((source) => source && typeof source === 'object' ? (source as { providerId?: unknown }).providerId : undefined);
  const providerCatalogMatches = sources.length === EXPECTED_MONITORED_PROVIDERS.length
    && [...providerIds].sort().join('|') === [...EXPECTED_MONITORED_PROVIDERS].sort().join('|');
  checks.push({
    id: 'source-catalog',
    status: providerCatalogMatches ? 'pass' : 'fail',
    detail: `${sources.length}/${EXPECTED_MONITORED_PROVIDERS.length} expected provider source records reported.`,
  });
  const sourceUrlsAreHttps = sources.length === 19 && sources.every((source) => {
    if (!source || typeof source !== 'object') return false;
    const sourceUrl = (source as { sourceUrl?: unknown }).sourceUrl;
    try { return typeof sourceUrl === 'string' && new URL(sourceUrl).protocol === 'https:'; } catch { return false; }
  });
  checks.push({
    id: 'https-source-boundary',
    status: sourceUrlsAreHttps ? 'pass' : 'fail',
    detail: sourceUrlsAreHttps ? 'All reported source URLs use HTTPS.' : 'One or more source URLs are missing or not HTTPS.',
  });
  checks.push({
    id: 'runtime-identity',
    status: payload?.runtime?.productizationV1Enabled === true
      && typeof payload.runtime.workerCommitSha === 'string'
      && /^[a-f0-9]{40,64}$/i.test(payload.runtime.workerCommitSha)
      && typeof payload.runtime.workerVersion === 'string'
      && payload.runtime.workerVersion.trim().length > 0
      ? 'pass' : 'fail',
    detail: payload?.runtime?.productizationV1Enabled === true
      && typeof payload.runtime.workerCommitSha === 'string'
      && /^[a-f0-9]{40,64}$/i.test(payload.runtime.workerCommitSha)
      ? `productizationV1Enabled=true, commit=${payload.runtime.workerCommitSha.slice(0, 12)}, version=${payload.runtime.workerVersion ?? 'unknown'}`
      : 'Production runtime must enable Productization V1 and report a valid commit and worker version.',
  });
  checks.push({
    id: 'provider-registry-identity',
    status: typeof payload?.runtime?.providerRegistryDigest === 'string'
      && /^[a-f0-9]{64}$/i.test(payload.runtime.providerRegistryDigest)
      ? 'pass' : 'fail',
    detail: typeof payload?.runtime?.providerRegistryDigest === 'string'
      && /^[a-f0-9]{64}$/i.test(payload.runtime.providerRegistryDigest)
      ? `provider registry digest=${payload.runtime.providerRegistryDigest.slice(0, 12)}`
      : 'Production runtime must report the SHA-256 digest of its reviewed provider registry.',
  });
  const normalizedExpectedDigest = expectedRegistryDigest?.trim().toLowerCase();
  const observedRegistryDigest = payload?.runtime?.providerRegistryDigest?.toLowerCase();
  checks.push({
    id: 'provider-registry-digest-match',
    status: normalizedExpectedDigest && /^[a-f0-9]{64}$/.test(normalizedExpectedDigest) && observedRegistryDigest === normalizedExpectedDigest
      ? 'pass' : 'fail',
    detail: normalizedExpectedDigest && /^[a-f0-9]{64}$/.test(normalizedExpectedDigest)
      ? observedRegistryDigest === normalizedExpectedDigest ? 'Deployed provider registry matches the expected release digest.' : 'Deployed provider registry does not match the expected release digest.'
      : 'Expected provider registry digest is required and must be a SHA-256 digest.',
  });
  const sourceHealthIsOperational = sources.length === EXPECTED_MONITORED_PROVIDERS.length && sources.every((source) => {
    if (!source || typeof source !== 'object') return false;
    const record = source as { enabled?: unknown; status?: unknown; lastSuccessAt?: unknown; parserStatus?: unknown; failureCount?: unknown };
    return record.enabled === true
      && record.status === 'healthy'
      && typeof record.lastSuccessAt === 'string'
      && !Number.isNaN(Date.parse(record.lastSuccessAt))
      && (record.parserStatus === 'structured' || record.parserStatus === 'review-only')
      && typeof record.failureCount === 'number'
      && record.failureCount === 0;
  });
  checks.push({
    id: 'source-operational-health',
    status: sourceHealthIsOperational ? 'pass' : 'fail',
    detail: sourceHealthIsOperational
      ? 'All 19 provider sources are enabled, healthy, recently successful, and parsed.'
      : 'Every provider source must be enabled, healthy, successfully fetched, parsed, and free of failures.',
  });
  const sourceSuccessesAreRecent = sources.length === EXPECTED_MONITORED_PROVIDERS.length && sources.every((source) => {
    if (!source || typeof source !== 'object') return false;
    const lastSuccessAt = (source as { lastSuccessAt?: unknown }).lastSuccessAt;
    if (typeof lastSuccessAt !== 'string') return false;
    const timestamp = Date.parse(lastSuccessAt);
    const age = Date.parse(observedAt) - timestamp;
    return Number.isFinite(timestamp) && age >= 0 && age <= MAX_SOURCE_AGE_MS;
  });
  checks.push({
    id: 'source-freshness',
    status: sourceSuccessesAreRecent ? 'pass' : 'fail',
    detail: sourceSuccessesAreRecent
      ? 'All 19 provider sources succeeded within the six-hour monitoring window.'
      : 'Every provider source must have a successful fetch no older than six hours at preflight time.',
  });
  const queueValues = Object.entries(payload?.queues ?? {});
  const queuesAreBounded = queueValues.length > 0 && queueValues.every(([, value]) => {
    if (typeof value === 'number') return isNonNegativeNumber(value);
    if (!value || typeof value !== 'object') return false;
    return Object.values(value as Record<string, unknown>).every(isNonNegativeNumber);
  });
  checks.push({
    id: 'queue-shape',
    status: queuesAreBounded ? 'pass' : 'fail',
    detail: queuesAreBounded ? 'Queue metrics are numeric and non-negative.' : 'Queue metrics are missing or malformed.',
  });

  const result: BetaLivePreflightResult = {
    baseUrl: normalizedUrl,
    status: checks.every((check) => check.status === 'pass') ? 'pass' : 'fail',
    checks,
    observedAt,
  };
  if (payload?.runtime) result.runtime = payload.runtime;
  return result;
}

const baseUrl = process.env.MY_OWL_BETA_BASE_URL;
const cronSecret = process.env.CRON_SECRET;
const expectedRegistryDigest = process.env.MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST;
if (process.argv[1]?.endsWith('beta-live-preflight.ts')) {
  if (!baseUrl || !cronSecret || !expectedRegistryDigest) {
    console.error('Set MY_OWL_BETA_BASE_URL, CRON_SECRET, and MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST. The secret is used only in the request and is never printed.');
    process.exitCode = 2;
  } else {
    try {
      const result = await runBetaLivePreflight(baseUrl, cronSecret, fetch, expectedRegistryDigest);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.status === 'pass' ? 0 : 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Live preflight failed.');
      process.exitCode = 1;
    }
  }
}
