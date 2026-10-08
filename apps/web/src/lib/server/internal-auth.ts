import { timingSafeEqual } from 'node:crypto';

/** Authorizes internal read-only endpoints without touching the database. */
export function isAuthorizedInternalRequest(
  request: Request,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret?.trim()) return false;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;

  const provided = authorization.slice('Bearer '.length);
  if (provided.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}
