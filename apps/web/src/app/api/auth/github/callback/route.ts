import { NextResponse } from 'next/server';
import {
  authenticateGitHubLogin,
  consumeGitHubLoginOAuthState,
  getGitHubLoginOAuthConfig,
  getGitHubLoginStateCookieOptions,
  GITHUB_LOGIN_STATE_COOKIE,
} from '@/lib/server/github-oauth.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '@/lib/server/auth.js';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';

function clearGitHubLoginCookie(response: NextResponse): void {
  response.cookies.set(GITHUB_LOGIN_STATE_COOKIE, '', getGitHubLoginStateCookieOptions(new Date(0)));
}

function redirectBase(req: Request): string {
  const config = getGitHubLoginOAuthConfig();
  return config?.redirectUri || req.url;
}

function redirectWithError(req: Request, code: string): NextResponse {
  const login = new URL('/login', redirectBase(req));
  login.searchParams.set('github', code);
  const response = NextResponse.redirect(login);
  clearGitHubLoginCookie(response);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(req: Request) {
  const rateCheck = await checkRateLimit(`auth:github-login-callback:${getClientIp(req)}`, 30, 15 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const providerError = url.searchParams.get('error');
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieState = cookieHeader.match(new RegExp(`(?:^|;\\s*)${GITHUB_LOGIN_STATE_COOKIE}=([^;]+)`))?.[1];

  const stateResult = await consumeGitHubLoginOAuthState(state, cookieState);
  if (!stateResult.valid) return redirectWithError(req, `github_${stateResult.code?.toLowerCase() || 'state_invalid'}`);
  if (providerError === 'access_denied') return redirectWithError(req, 'github_denied');
  if (!code || !stateResult.codeVerifier) return redirectWithError(req, 'github_callback_invalid');

  const config = getGitHubLoginOAuthConfig();
  if (!config) return redirectWithError(req, 'github_unavailable');

  try {
    const result = await authenticateGitHubLogin(config, code, stateResult.codeVerifier);
    if (result.kind === 'account_exists') return redirectWithError(req, 'github_account_exists');
    if (!result.user || !result.session) return redirectWithError(req, 'github_account_invalid');

    const destination = stateResult.returnTo || '/dashboard';
    const response = NextResponse.redirect(new URL(destination, redirectBase(req)));
    response.cookies.set(AUTH_COOKIE_NAME, result.session.id, getAuthCookieOptions(result.session.expiresAt));
    clearGitHubLoginCookie(response);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const codeMap: Record<string, string> = {
      GITHUB_OAUTH_DENIED: 'github_denied',
      GITHUB_OAUTH_CODE_INVALID: 'github_callback_invalid',
      GITHUB_OAUTH_TOKEN_EXCHANGE_FAILED: 'github_provider_error',
      GITHUB_OAUTH_PROFILE_FETCH_FAILED: 'github_provider_error',
      GITHUB_OAUTH_PROFILE_INVALID: 'github_profile_invalid',
      GITHUB_OAUTH_EMAIL_UNVERIFIED: 'github_email_unverified',
    };
    return redirectWithError(req, codeMap[message] || 'github_signin_failed');
  }
}
