import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'apiproof_session';

const PROTECTED_PREFIXES = ['/dashboard', '/api/overview', '/api/repositories', '/api/findings', '/api/migrations', '/api/pull-requests', '/api/activity'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow /api/auth itself (login/signup/logout)
  if (pathname === '/api/auth') {
    return NextResponse.next();
  }

  // Check if the route requires authentication
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    // Dashboard pages redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/api/overview/:path*',
    '/api/repositories/:path*',
    '/api/findings/:path*',
    '/api/migrations/:path*',
    '/api/pull-requests/:path*',
    '/api/activity/:path*',
  ],
};
