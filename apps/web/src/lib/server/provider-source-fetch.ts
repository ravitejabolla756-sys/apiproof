import { lookup } from 'node:dns/promises';

const MAX_SOURCE_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_FETCH_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_RETRY_AFTER_MS = 5_000;

export type ResolveHost = (hostname: string, options: { all: true; verbatim: true }) => Promise<readonly { address: string }[]>;

export type SourceRow = {
  id: string;
  content_hash: string | null;
  etag: string | null;
  last_modified: string | null;
};

export type SourceFetchOptions = {
  fetchImpl?: typeof fetch;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
  retryDelayMs?: number;
};

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === 'localhost' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first = -1, second = -1] = octets;
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

async function assertOfficialUrl(rawUrl: string, sourceUrl: string, resolveHost: ResolveHost): Promise<URL> {
  const url = new URL(rawUrl);
  const sourceHost = new URL(sourceUrl).hostname;
  if (url.protocol !== 'https:' || url.port || url.hostname !== sourceHost) throw new Error('SOURCE_URL_NOT_ALLOWLISTED');
  const addresses = await resolveHost(url.hostname, { all: true, verbatim: true });
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('SOURCE_HOST_RESOLVES_PRIVATE');
  return url;
}

async function readBoundedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_SOURCE_BYTES) throw new Error('SOURCE_BODY_TOO_LARGE');
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!next.value) continue;
      total += next.value.byteLength;
      if (total > MAX_SOURCE_BYTES) throw new Error('SOURCE_BODY_TOO_LARGE');
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError;
}

async function waitBeforeRetry(attempt: number, delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs * (2 ** (attempt - 1))));
}

function retryAfterMs(response: Response, nowMs = Date.now()): number | undefined {
  const value = response.headers.get('retry-after')?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1_000, MAX_RETRY_AFTER_MS);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.min(Math.max(0, timestamp - nowMs), MAX_RETRY_AFTER_MS);
}

export async function fetchOfficialSource(source: { sourceUrl: string }, row: SourceRow, options: SourceFetchOptions): Promise<{ status: number; body: string; etag: string | null; lastModified: string | null }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? lookup;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let currentUrl = source.sourceUrl;
  for (let redirectCount = 0; redirectCount <= 2; redirectCount += 1) {
    const url = await assertOfficialUrl(currentUrl, source.sourceUrl, resolveHost);
    const headers = new Headers({ accept: 'text/html, text/plain, application/json, application/xml;q=0.9' });
    if (row.etag) headers.set('if-none-match', row.etag);
    if (row.last_modified) headers.set('if-modified-since', row.last_modified);
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
      } catch (error) {
        if (attempt === MAX_FETCH_ATTEMPTS || !isRetryableError(error)) throw error;
        await waitBeforeRetry(attempt, retryDelayMs);
        continue;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('SOURCE_REDIRECT_WITHOUT_LOCATION');
        currentUrl = new URL(location, url).toString();
        break;
      }
      if (response.status === 304) return { status: 304, body: '', etag: row.etag, lastModified: row.last_modified };
      if (!response.ok) {
        if (attempt < MAX_FETCH_ATTEMPTS && isRetryableStatus(response.status)) {
          const providerDelay = retryAfterMs(response);
          await waitBeforeRetry(attempt, providerDelay === undefined ? retryDelayMs : providerDelay);
          continue;
        }
        throw new Error(`SOURCE_HTTP_${response.status}`);
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      if (contentType && !['text/html', 'text/plain', 'application/json', 'application/xml', 'text/xml'].includes(contentType)) throw new Error('SOURCE_CONTENT_TYPE_UNSUPPORTED');
      return { status: response.status, body: await readBoundedBody(response), etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') };
    }
  }
  throw new Error('SOURCE_REDIRECT_LIMIT');
}
