import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  getCurrentUser,
  authenticateUser,
  createUserWithSession,
  createSession,
  deleteSession,
  extractSessionId,
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from '@/lib/server/auth.js';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  assertCsrfProtection,
  validateSignupInput,
  validateLoginInput,
  validatePasswordResetRequestInput,
  validatePasswordResetCompletionInput,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation.js';
import { requestPasswordReset, completePasswordReset } from '@/lib/server/password-reset.js';
import { isPasswordResetEmailConfigured } from '@/lib/server/password-reset-email.js';
import { requestTrackedEmailVerification } from '@/lib/server/email-verification-notification.js';
import { isValidEmailVerificationToken, verifyEmail } from '@/lib/server/email-verification.js';
import { EmailDeliveryUnavailableError } from '@/lib/server/email-delivery-state.js';

const AUTH_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

function authResponse(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(AUTH_NO_STORE_HEADERS)) headers.set(name, value);
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return authResponse({ authenticated: false, user: null, code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return authResponse({ authenticated: true, user });
}

export async function POST(req: Request) {
  // 1. CSRF / Origin protection
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const clientIp = getClientIp(req);

  try {
    const body = (await req.json()) as Record<string, unknown> | null;
    const action = body?.action;

    if (action === 'request_password_reset') {
      if (!isPasswordResetEmailConfigured()) {
        return authResponse(
          { error: 'Password recovery is temporarily unavailable.', code: 'PASSWORD_RESET_UNAVAILABLE' },
          { status: 503 },
        );
      }
      const validation = validatePasswordResetRequestInput(body);
      if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid request.');
      const { email } = validation.data;
      const emailKey = crypto.createHash('sha256').update(email).digest('hex');
      const [ipLimit, emailLimit] = await Promise.all([
        checkRateLimit(`auth:password-reset:ip:${clientIp}`, 10, 15 * 60 * 1000, { failClosed: true }),
        checkRateLimit(`auth:password-reset:email:${emailKey}`, 3, 60 * 60 * 1000, { failClosed: true }),
      ]);
      if (!ipLimit.allowed || !emailLimit.allowed) {
        return rateLimitResponse(Math.max(ipLimit.resetInMs, emailLimit.resetInMs));
      }

      try {
        await requestPasswordReset(email);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'PASSWORD_RESET_DELIVERY_FAILED') throw error;
        // Keep the response indistinguishable for existing and unknown accounts.
        console.error('[password-reset] Email delivery failed.');
      }
      return authResponse({ success: true, message: 'If an account exists for that email, reset instructions will be sent.' }, { status: 202 });
    }

    if (action === 'complete_password_reset') {
      const validation = validatePasswordResetCompletionInput(body);
      if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid request.');
      const rateCheck = await checkRateLimit(`auth:password-reset-complete:${clientIp}`, 10, 15 * 60 * 1000, { failClosed: true });
      if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

      const completed = await completePasswordReset(validation.data.token, validation.data.password);
      if (!completed) {
        return authResponse({ error: 'This reset link is invalid or expired.', code: 'INVALID_RESET_TOKEN' }, { status: 400 });
      }
      return authResponse({ success: true, message: 'Password reset successfully. Sign in with your new password.' });
    }

    if (action === 'logout') {
      const sessionId = extractSessionId(req);
      if (sessionId) {
        await deleteSession(sessionId);
      }
      const res = authResponse({ success: true, message: 'Logged out successfully.' });
      const clearOptions = getClearAuthCookieOptions();
      res.cookies.set(AUTH_COOKIE_NAME, '', clearOptions);
      return res;
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
        const cookieOptions = getAuthCookieOptions(session.expiresAt);
        const res = authResponse({ success: true, user });
        res.cookies.set(AUTH_COOKIE_NAME, session.id, cookieOptions);
        return res;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('UNIQUE constraint failed') ||
          message.includes('unique constraint') ||
          message.includes('duplicate key')
        ) {
          return authResponse(
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
      const emailKey = crypto.createHash('sha256').update(email, 'utf8').digest('hex');
      const rateCheck = await checkRateLimit(`auth:login:${clientIp}:${emailKey}`, 10, 5 * 60 * 1000);
      if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.resetInMs);
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        return authResponse(
          { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
          { status: 401 }
        );
      }

      const session = await createSession(user.id);
      const cookieOptions = getAuthCookieOptions(session.expiresAt);
      const res = authResponse({ success: true, user });
      res.cookies.set(AUTH_COOKIE_NAME, session.id, cookieOptions);
      return res;
    }

    if (action === 'verify_email') {
      const token = body && typeof body.token === 'string' ? body.token : undefined;
      if (!isValidEmailVerificationToken(token)) return badRequestResponse('A valid email verification token is required.');
      const result = await verifyEmail(token);
      if (result === 'invalid') return authResponse({ error: 'This email verification link is invalid or expired.', code: 'INVALID_EMAIL_VERIFICATION_TOKEN' }, { status: 400 });
      return authResponse({ success: true, code: result === 'already_verified' ? 'EMAIL_ALREADY_VERIFIED' : 'EMAIL_VERIFIED' });
    }

    if (action === 'resend_verification') {
      const user = await getCurrentUser(req);
      if (!user) return authResponse({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      const rateCheck = await checkRateLimit(`auth:resend-verification:${clientIp}:${user.id}`, 3, 15 * 60 * 1000, { failClosed: true });
      if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);
      try {
        const result = await requestTrackedEmailVerification(user.id);
        if (result === 'already_verified') return authResponse({ success: true, code: 'EMAIL_ALREADY_VERIFIED' });
        if (result === 'unavailable') return authResponse({ error: 'Email verification is temporarily unavailable.', code: 'EMAIL_VERIFICATION_UNAVAILABLE' }, { status: 503 });
        return authResponse({ success: true, code: 'EMAIL_VERIFICATION_SENT' }, { status: 202 });
      } catch (error) {
        if (error instanceof EmailDeliveryUnavailableError || (error instanceof Error && error.message === 'EMAIL_VERIFICATION_EMAIL_NOT_CONFIGURED')) {
          return authResponse({ error: 'Email verification is temporarily unavailable.', code: 'EMAIL_VERIFICATION_UNAVAILABLE' }, { status: 503 });
        }
        throw error;
      }
    }

    return authResponse({ error: 'Invalid action. Supported: login, signup, logout, request_password_reset, complete_password_reset, verify_email, resend_verification.', code: 'INVALID_ACTION' }, { status: 400 });
  } catch {
    return authResponse({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
