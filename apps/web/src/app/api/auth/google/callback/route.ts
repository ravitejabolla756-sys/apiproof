import { NextResponse } from 'next/server';
import {
  authenticateGoogleOAuth,
  consumeGoogleOAuthState,
  getGoogleOAuthConfig,
  getGoogleOAuthStateCookieOptions,
  GOOGLE_OAUTH_STATE_COOKIE,
} from '@/lib/server/google-oauth.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/lib/server/auth.js';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';

function clearGoogleOAuthCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', getGoogleOAuthStateCookieOptions(new Date(0)));
}

function redirectBase(req: Request): string {
  const config = getGoogleOAuthConfig();
  return config?.redirectUri || req.url;
}

function redirectWithError(req: Request, code: string): NextResponse {
  const login = new URL('/login', redirectBase(req));
  login.searchParams.set('google', code);
  const response = NextResponse.redirect(login);
  clearGoogleOAuthCookie(response);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(req: Request) {
  const rateCheck = await checkRateLimit(`auth:google-callback:${getClientIp(req)}`, 30, 15 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const providerError = url.searchParams.get('error');
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieState = cookieHeader.match(new RegExp(`(?:^|;\\s*)${GOOGLE_OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];

  const stateResult = await consumeGoogleOAuthState(state, cookieState);
  if (!stateResult.valid) return redirectWithError(req, `google_${stateResult.code?.toLowerCase() || 'state_invalid'}`);
  if (providerError === 'access_denied') return redirectWithError(req, 'google_denied');
  if (!code || !stateResult.codeVerifier || !stateResult.nonce) return redirectWithError(req, 'google_callback_invalid');

  const config = getGoogleOAuthConfig();
  if (!config) return redirectWithError(req, 'google_unavailable');

  try {
    const result = await authenticateGoogleOAuth(config, code, stateResult.codeVerifier, stateResult.nonce);
    if (result.kind === 'account_exists') return redirectWithError(req, 'google_account_exists');
    if (!result.user || !result.session) return redirectWithError(req, 'google_account_invalid');

    const destination = result.kind === 'created' ? '/onboarding' : (stateResult.returnTo || '/dashboard');
    const response = NextResponse.redirect(new URL(destination, redirectBase(req)));
    response.cookies.set(AUTH_COOKIE_NAME, result.session.id, getAuthCookieOptions(result.session.expiresAt));
    clearGoogleOAuthCookie(response);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const codeMap: Record<string, string> = {
      GOOGLE_OAUTH_DENIED: 'google_denied',
      GOOGLE_OAUTH_CODE_INVALID: 'google_callback_invalid',
      GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED: 'google_provider_error',
      GOOGLE_JWKS_UNAVAILABLE: 'google_provider_error',
      GOOGLE_JWKS_INVALID: 'google_provider_error',
      GOOGLE_ID_TOKEN_INVALID: 'google_token_invalid',
      GOOGLE_ID_TOKEN_KEY_UNKNOWN: 'google_token_invalid',
      GOOGLE_ID_TOKEN_SIGNATURE_INVALID: 'google_token_invalid',
      GOOGLE_ID_TOKEN_CLAIMS_INVALID: 'google_token_invalid',
    };
    return redirectWithError(req, codeMap[message] || 'google_signin_failed');
  }
}
