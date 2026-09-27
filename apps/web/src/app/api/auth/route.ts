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

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, name } = body;

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
      if (!email || !password || !name) {
        return NextResponse.json({ error: 'Email, password, and name are required.' }, { status: 400 });
      }
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
          return NextResponse.json({ error: 'User with this email already exists.' }, { status: 409 });
        }
        throw err;
      }
    }

    if (action === 'login') {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
      }
      const user = await authenticateUser(email, password);
      if (!user) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
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

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
