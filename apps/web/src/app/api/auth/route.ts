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
import { isEmailVerificationConfigured, requestEmailVerificationCode, verifyEmailCode } from '@/lib/server/email-verification.js';

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
    const body = (await req.json()) as Record<string, unknown> | null;
    const action = body?.action;

    if (action === 'request_password_reset') {
      if (!isPasswordResetEmailConfigured()) {
        return NextResponse.json(
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
      return NextResponse.json({ success: true, message: 'If an account exists for that email, reset instructions will be sent.' }, { status: 202 });
    }

    if (action === 'complete_password_reset') {
      const validation = validatePasswordResetCompletionInput(body);
      if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid request.');
      const rateCheck = await checkRateLimit(`auth:password-reset-complete:${clientIp}`, 10, 15 * 60 * 1000, { failClosed: true });
      if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

      const completed = await completePasswordReset(validation.data.token, validation.data.password);
      if (!completed) {
        return NextResponse.json({ error: 'This reset link is invalid or expired.', code: 'INVALID_RESET_TOKEN' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Password reset successfully. Sign in with your new password.' });
    }

    if (action === 'request_email_verification') {
      const user = await getCurrentUser(req);
      if (!user) return NextResponse.json({ error: 'Sign in to verify your email.', code: 'UNAUTHORIZED' }, { status: 401 });
      if (!isEmailVerificationConfigured()) return NextResponse.json({ error: 'Email verification is temporarily unavailable.', code: 'EMAIL_VERIFICATION_UNAVAILABLE' }, { status: 503 });
      const rate = await checkRateLimit(`auth:email-verification:${user.id}`, 3, 15 * 60 * 1000, { failClosed: true });
      if (!rate.allowed) return rateLimitResponse(rate.resetInMs);
      let result: 'sent' | 'already_verified';
      try {
        result = await requestEmailVerificationCode(user.id);
      } catch {
        console.error('[email-verification] Code delivery failed.');
        return NextResponse.json(
          { error: 'We could not send your code right now. Please try again later.', code: 'EMAIL_VERIFICATION_DELIVERY_FAILED' },
          { status: 503 },
        );
      }
      return NextResponse.json({ success: true, alreadyVerified: result === 'already_verified', message: result === 'already_verified' ? 'Your email is already verified.' : 'A verification code has been sent to your email.' }, { status: 202 });
    }

    if (action === 'verify_email') {
      const user = await getCurrentUser(req);
      if (!user) return NextResponse.json({ error: 'Sign in to verify your email.', code: 'UNAUTHORIZED' }, { status: 401 });
      const code = body && typeof body.code === 'string' ? body.code.trim() : '';
      if (!/^\d{6}$/.test(code)) return badRequestResponse('Enter the six-digit code from your email.');
      const rate = await checkRateLimit(`auth:email-verification-check:${user.id}`, 10, 15 * 60 * 1000, { failClosed: true });
      if (!rate.allowed) return rateLimitResponse(rate.resetInMs);
      const verified = await verifyEmailCode(user.id, code);
      if (!verified) return NextResponse.json({ error: 'That code is invalid or expired. Request a new code and try again.', code: 'INVALID_EMAIL_VERIFICATION_CODE' }, { status: 400 });
      return NextResponse.json({ success: true, message: 'Email verified successfully.' });
    }

    if (action === 'logout') {
      const sessionId = extractSessionId(req);
      if (sessionId) {
        await deleteSession(sessionId);
      }
      const res = NextResponse.json({ success: true, message: 'Logged out successfully.' });
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
        let emailSent = false;
        try {
          await requestEmailVerificationCode(user.id);
          emailSent = true;
        } catch {
          console.error('[email-verification] Signup code delivery failed.');
        }
        const cookieOptions = getAuthCookieOptions(session.expiresAt);
        const res = NextResponse.json({ success: true, user, verificationRequired: true, emailSent }, { status: 202 });
        res.cookies.set(AUTH_COOKIE_NAME, session.id, cookieOptions);
        return res;
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
      const cookieOptions = getAuthCookieOptions(session.expiresAt);
      const res = NextResponse.json({ success: true, user });
      res.cookies.set(AUTH_COOKIE_NAME, session.id, cookieOptions);
      return res;
    }

    return NextResponse.json({ error: 'Invalid action. Supported: login, signup, logout, request_password_reset, complete_password_reset, request_email_verification, verify_email.', code: 'INVALID_ACTION' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
