import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getCurrentUser,
  authenticateUser,
  createUserWithSession,
  createSession,
  deleteSession,
  AUTH_COOKIE_NAME,
} from '@/lib/server/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit';
import {
  assertCsrfProtection,
  validateSignupInput,
  validateLoginInput,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null, code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user });
}

export async function POST(req: Request) {
  // 1. CSRF / Origin protection
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const clientIp = getClientIp(req);

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === 'logout') {
      const cookieStore = await cookies();
      const sessionId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      if (sessionId) {
        await deleteSession(sessionId);
      }
      cookieStore.delete(AUTH_COOKIE_NAME);
      return NextResponse.json({ success: true, message: 'Logged out successfully.' });
    }

    if (action === 'signup') {
      // Rate limit: 5 signups per 15 minutes per IP
      const rateCheck = await checkRateLimit(`auth:signup:${clientIp}`, 5, 15 * 60 * 1000);
      if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.resetInMs);
      }

      // Input validation
      const validation = validateSignupInput(body);
      if (!validation.valid || !validation.data) {
        return badRequestResponse(validation.error || 'Invalid signup payload.');
      }

      const { email, password, name } = validation.data;

      try {
        const { user, session } = await createUserWithSession(email, password, name);
        const cookieStore = await cookies();
        cookieStore.set(AUTH_COOKIE_NAME, session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
        return NextResponse.json({ success: true, user });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('UNIQUE constraint failed') ||
          message.includes('unique constraint') ||
          message.includes('duplicate key')
        ) {
          return NextResponse.json(
            { error: 'User with this email already exists.', code: 'USER_ALREADY_EXISTS' },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    if (action === 'login') {
      // Input validation
      const validation = validateLoginInput(body);
      if (!validation.valid || !validation.data) {
        return badRequestResponse(validation.error || 'Invalid login payload.');
      }

      const { email, password } = validation.data;

      // Rate limit: 10 login attempts per 5 minutes per IP + email
      const rateCheck = await checkRateLimit(`auth:login:${clientIp}:${email}`, 10, 5 * 60 * 1000);
      if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.resetInMs);
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
          { status: 401 }
        );
      }

      const session = await createSession(user.id);
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return NextResponse.json({ success: true, user });
    }

    return NextResponse.json({ error: 'Invalid action. Supported: login, signup, logout.', code: 'INVALID_ACTION' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error.';
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

