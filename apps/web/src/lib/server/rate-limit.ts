import { getDatabase } from './db/index.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

// In-memory fallback map for resilience across transient database delays
const inMemoryFallback = new Map<string, { points: number; resetAt: number }>();

export function resetRateLimits(): void {
  inMemoryFallback.clear();
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Checks and increments rate limit for a specific key.
 * Uses PostgreSQL / SQLite rate_limits table with fallback to in-memory window.
 *
 * Serverless Note:
 * Persistent database rows ensure rate limit enforcement is distributed across
 * all concurrent Vercel serverless lambda instances.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: { failClosed?: boolean } = {},
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const db = getDatabase();
    const row = await db.queryOne<{ points: number; reset_at: number | string }>(`
      INSERT INTO rate_limits (key, points, reset_at)
      VALUES (?, 1, ?)
      ON CONFLICT (key) DO UPDATE SET
        points = CASE
          WHEN rate_limits.reset_at <= ? THEN 1
          WHEN rate_limits.points >= ? THEN ? + 1
          ELSE rate_limits.points + 1
        END,
        reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
      RETURNING points, reset_at
    `, [key, now + windowMs, now, limit, limit, now]);
    if (!row) throw new Error('RATE_LIMIT_UPDATE_RETURNED_NO_ROW');

    const resetAt = Number(row.reset_at);
    const points = Number(row.points);
    return {
      allowed: points <= limit,
      remaining: Math.max(0, limit - points),
      resetInMs: Math.max(0, resetAt - now),
    };
  } catch (err) {
    if (options.failClosed) {
      throw new Error('RATE_LIMIT_STORE_UNAVAILABLE', { cause: err });
    }
    // In-memory fallback if database table is unavailable or busy
    console.warn('Rate limiter database lookup failed, using memory fallback:', err);
    const cached = inMemoryFallback.get(key);
    if (!cached || cached.resetAt <= now) {
      const resetAt = now + windowMs;
      inMemoryFallback.set(key, { points: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
    }

    if (cached.points >= limit) {
      return { allowed: false, remaining: 0, resetInMs: Math.max(0, cached.resetAt - now) };
    }

    cached.points += 1;
    return { allowed: true, remaining: limit - cached.points, resetInMs: Math.max(0, cached.resetAt - now) };
  }
}

export function rateLimitResponse(resetInMs: number): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(resetInMs / 1000));
  return Response.json(
    {
      error: 'Too many requests. Please wait a moment before trying again.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
