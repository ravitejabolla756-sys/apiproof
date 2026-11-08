import { timingSafeEqual } from 'node:crypto';

/** Validate the shared cron bearer credential without leaking its value. */
export function isAuthorizedCronRequest(request: Pick<Request, 'headers'>): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer +(.+)$/i);
  if (!expected || !match) return false;

  const providedBytes = Buffer.from(match[1]!, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (providedBytes.length !== expectedBytes.length) return false;

  return timingSafeEqual(providedBytes, expectedBytes);
}
