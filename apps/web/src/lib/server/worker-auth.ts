import crypto from 'node:crypto';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const WORKER_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export type WorkerAuthInput = {
  secret: string;
  workerId: string;
  timestamp?: number;
  method?: string;
  pathname?: string;
};

function canonicalRequest(input: Required<Pick<WorkerAuthInput, 'workerId' | 'timestamp' | 'method' | 'pathname'>>): string {
  return `${input.workerId}\n${input.timestamp}\n${input.method.toUpperCase()}\n${input.pathname}`;
}

function sign(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function createWorkerAuthHeaders(input: WorkerAuthInput): Record<string, string> {
  const timestamp = input.timestamp ?? Date.now();
  const method = input.method ?? 'GET';
  const pathname = input.pathname ?? '/';
  if (!input.secret.trim() || !WORKER_ID_PATTERN.test(input.workerId)) throw new Error('WORKER_AUTH_INPUT_INVALID');
  const signature = sign(input.secret, canonicalRequest({ workerId: input.workerId, timestamp, method, pathname }));
  return {
    'x-apiproof-worker-id': input.workerId,
    'x-apiproof-worker-timestamp': String(timestamp),
    'x-apiproof-worker-signature': signature,
  };
}

export function verifyWorkerRequest(request: Request, now = Date.now()): boolean {
  const secret = process.env.WORKER_AUTH_SECRET?.trim();
  const workerId = request.headers.get('x-apiproof-worker-id')?.trim() ?? '';
  const timestampText = request.headers.get('x-apiproof-worker-timestamp')?.trim() ?? '';
  const signature = request.headers.get('x-apiproof-worker-signature')?.trim().toLowerCase() ?? '';
  const timestamp = Number(timestampText);
  if (!secret || !WORKER_ID_PATTERN.test(workerId) || !/^\d{10,}$/.test(timestampText) || !Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW_MS) return false;
  let pathname: string;
  try { pathname = new URL(request.url).pathname; } catch { return false; }
  const expected = sign(secret, canonicalRequest({ workerId, timestamp, method: request.method, pathname }));
  return equalHex(signature, expected);
}

function verifyLegacyBearer(request: Request): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const secret = process.env.CRON_SECRET?.trim() ?? '';
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? '';
  if (!secret || provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

/**
 * Internal HTTP workers use signed identity in production. The legacy bearer
 * contract remains test-only so existing disposable local fixtures stay valid.
 */
export function verifyInternalWorkerRequest(request: Request): boolean {
  return verifyWorkerRequest(request) || verifyLegacyBearer(request);
}

export function workerIdentityToken(secret: string, workerId: string): string {
  if (!secret.trim() || !WORKER_ID_PATTERN.test(workerId)) throw new Error('WORKER_AUTH_INPUT_INVALID');
  return sign(secret, `worker:${workerId}`);
}

export function assertTrustedWorkerIdentity(workerId: string, suppliedToken?: string): void {
  const secret = process.env.WORKER_AUTH_SECRET?.trim() ?? '';
  const token = suppliedToken?.trim() || process.env.WORKER_AUTH_TOKEN?.trim() || '';
  if (!secret || !WORKER_ID_PATTERN.test(workerId) || !equalHex(token, workerIdentityToken(secret, workerId))) {
    throw new Error('TRUSTED_WORKER_IDENTITY_REQUIRED');
  }
}
