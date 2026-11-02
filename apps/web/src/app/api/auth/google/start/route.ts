import { NextResponse } from 'next/server';
import {
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  getGoogleOAuthStateCookieOptions,
  GOOGLE_OAUTH_STATE_COOKIE,
  persistGoogleOAuthState,
} from '@/lib/server/google-oauth.js';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';

export async function GET(req: Request) {
  const rateCheck = await checkRateLimit(`auth:google-start:${getClientIp(req)}`, 20, 15 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

  const config = getGoogleOAuthConfig();
  if (!config) return NextResponse.json({ error: 'Google sign-in is not configured.', code: 'GOOGLE_OAUTH_UNAVAILABLE' }, { status: 503 });

  const oauthState = createGoogleOAuthState();
  await persistGoogleOAuthState(oauthState, new URL(req.url).searchParams.get('next') ?? undefined);
  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', oauthState.state);
  authorize.searchParams.set('code_challenge', oauthState.codeChallenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('nonce', oauthState.nonce);
  authorize.searchParams.set('access_type', 'online');

  const response = NextResponse.redirect(authorize);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, oauthState.state, getGoogleOAuthStateCookieOptions());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
