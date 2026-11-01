import { NextResponse } from 'next/server';
import {
  createGitHubLoginOAuthState,
  getGitHubLoginOAuthConfig,
  getGitHubLoginStateCookieOptions,
  GITHUB_LOGIN_STATE_COOKIE,
  persistGitHubLoginOAuthState,
} from '@/lib/server/github-oauth.js';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';

export async function GET(req: Request) {
  const rateCheck = await checkRateLimit(`auth:github-login-start:${getClientIp(req)}`, 20, 15 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

  const config = getGitHubLoginOAuthConfig();
  if (!config) return NextResponse.json({ error: 'GitHub sign-in is not configured.', code: 'GITHUB_OAUTH_UNAVAILABLE' }, { status: 503 });

  const state = createGitHubLoginOAuthState();
  await persistGitHubLoginOAuthState(state, new URL(req.url).searchParams.get('next') ?? undefined);
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('scope', 'read:user user:email');
  authorize.searchParams.set('state', state.state);
  authorize.searchParams.set('code_challenge', state.codeChallenge);
  authorize.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authorize);
  response.cookies.set(GITHUB_LOGIN_STATE_COOKIE, state.state, getGitHubLoginStateCookieOptions());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
