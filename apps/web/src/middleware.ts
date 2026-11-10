import { NextResponse, type NextRequest } from 'next/server';
import { applySecurityHeaders, resolveCorsOrigin } from '@/lib/server/security-headers.js';

const AUTH_COOKIE_NAME = 'apiproof_session';

const PROTECTED_PREFIXES = ['/dashboard', '/api/overview', '/api/repositories', '/api/findings', '/api/migrations', '/api/pull-requests', '/api/activity'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith('/api/');
  const corsOrigin = resolveCorsOrigin(request.headers.get('origin'));

  if (isApiRequest && request.method === 'OPTIONS') {
    if (request.headers.get('origin') && !corsOrigin) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'CORS origin denied.' }, { status: 403 }),
        { isHttps: request.nextUrl.protocol === 'https:', isDevelopment: process.env.NODE_ENV !== 'production', isApiRequest, origin: request.headers.get('origin') },
      );
    }

    return applySecurityHeaders(
      new NextResponse(null, { status: 204 }),
      { isHttps: request.nextUrl.protocol === 'https:', isDevelopment: process.env.NODE_ENV !== 'production', isApiRequest, origin: request.headers.get('origin') },
    );
  }

  const securityOptions = {
    isHttps: request.nextUrl.protocol === 'https:',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isApiRequest,
    origin: request.headers.get('origin'),
  } as const;

  // Allow /api/auth itself (login/signup/logout)
  if (pathname === '/api/auth') {
    return applySecurityHeaders(NextResponse.next(), securityOptions);
  }

  // Check if the route requires authentication
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return applySecurityHeaders(NextResponse.next(), securityOptions);
  }

  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return applySecurityHeaders(NextResponse.json({ error: 'Authentication required.' }, { status: 401 }), securityOptions);
    }
    // Dashboard pages redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), securityOptions);
  }

  return applySecurityHeaders(NextResponse.next(), securityOptions);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
