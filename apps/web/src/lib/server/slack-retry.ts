export class SlackApiFailure extends Error {
  constructor(readonly category: string, readonly retryable = false, readonly retryAfterMs = 0) {
    super(category);
  }
}

export function slackErrorCategory(error: unknown): string {
  if (error instanceof SlackApiFailure) return error.category;
  return error instanceof Error ? error.message.match(/\b[A-Z][A-Z0-9_]{3,}\b/)?.[0] ?? 'SLACK_OPERATION_FAILED' : 'SLACK_OPERATION_FAILED';
}

export function isRetryableSlackFailure(error: unknown): boolean {
  return error instanceof SlackApiFailure ? error.retryable
    : /^(GITHUB_NETWORK|GITHUB_RATE_LIMIT|GITHUB_UNAVAILABLE|VERIFICATION_JOB_ENQUEUE_FAILED|SLACK_PROPOSAL_RECONCILIATION_REQUIRED)$/.test(slackErrorCategory(error));
}

export function slackRetryAt(attempt: number, retryAfterMs = 0): string {
  return new Date(Date.now() + Math.max(Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 15 * 60_000), retryAfterMs)).toISOString();
}

/** No credential or provider-body text is included in errors/logs. */
export async function slackApi<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new SlackApiFailure('SLACK_NETWORK_FAILED', true);
  }
  const seconds = Number(response.headers.get('Retry-After'));
  const retryAfterMs = Number.isFinite(seconds) && seconds > 0 && seconds <= 31_536_000 ? seconds * 1000 : 0;
  if (!response.ok) throw new SlackApiFailure(`SLACK_HTTP_${response.status}`, response.status === 429 || response.status >= 500, retryAfterMs);
  let body: { ok?: unknown; error?: unknown } & T;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid response');
    body = parsed as typeof body;
  }
  catch { throw new SlackApiFailure('SLACK_RESPONSE_INVALID'); }
  if (body.ok !== true) {
    const providerError = typeof body.error === 'string' ? body.error : 'UNKNOWN';
    const category = `SLACK_API_${providerError.replace(/[^A-Za-z0-9_]/g, '').toUpperCase().slice(0, 80)}`;
    throw new SlackApiFailure(category, ['ratelimited', 'rate_limited', 'internal_error', 'fatal_error', 'service_unavailable'].includes(providerError), retryAfterMs);
  }
  return body;
}
