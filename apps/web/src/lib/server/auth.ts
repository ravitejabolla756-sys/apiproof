import crypto from 'node:crypto';
import { getDatabase, type SqliteDatabaseAdapter } from './db/index.js';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export const AUTH_COOKIE_NAME = 'apiproof_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000); // 2,592,000 seconds

function isSessionExpired(expiresAt: string): boolean {
  const expiryTime = Date.parse(expiresAt);
  return !Number.isFinite(expiryTime) || expiryTime <= Date.now();
}

export interface AuthCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
  expires: Date;
}

export function getAuthCookieOptions(expiresAt?: string | Date): AuthCookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const expiresDate = expiresAt ? new Date(expiresAt) : new Date(Date.now() + SESSION_TTL_MS);
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    expires: expiresDate,
  };
}

export function getClearAuthCookieOptions(): AuthCookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  if (keyBuffer.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, hashBuffer);
}

export async function createUserAsync(email: string, password: string, name: string): Promise<User> {
  const db = getDatabase();
  const id = `usr_${crypto.randomBytes(12).toString('hex')}`;
  const workspaceId = `ws_${crypto.randomBytes(10).toString('hex')}`;
  const memberId = `wsm_${crypto.randomBytes(10).toString('hex')}`;
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();
  const slugPrefix = cleanEmail.split('@')[0]!.replace(/[^a-z0-9]/g, '-') || 'workspace';
  const slug = `${slugPrefix}-${crypto.randomBytes(3).toString('hex')}`;

  return await db.transaction(async (tx) => {
    await tx.execute(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, cleanEmail, passwordHash, cleanName, now]);

    await tx.execute(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [workspaceId, `${cleanName}'s Workspace`, slug, now, now]);

    await tx.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `, [memberId, workspaceId, id, now]);

    return { id, email: cleanEmail, name: cleanName, createdAt: now };
  });
}

export function createUser(email: string, password: string, name: string): User;
export function createUser(email: string, password: string, name: string): Promise<User>;
export function createUser(email: string, password: string, name: string): User | Promise<User> {
  const db = getDatabase();
  if (db.engine === 'sqlite') {
    const id = `usr_${crypto.randomBytes(12).toString('hex')}`;
    const workspaceId = `ws_${crypto.randomBytes(10).toString('hex')}`;
    const memberId = `wsm_${crypto.randomBytes(10).toString('hex')}`;
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const slugPrefix = cleanEmail.split('@')[0]!.replace(/[^a-z0-9]/g, '-') || 'workspace';
    const slug = `${slugPrefix}-${crypto.randomBytes(3).toString('hex')}`;

    const sqlite = db as SqliteDatabaseAdapter;
    sqlite.executeSync(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, cleanEmail, passwordHash, cleanName, now]);

    sqlite.executeSync(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [workspaceId, `${cleanName}'s Workspace`, slug, now, now]);

    sqlite.executeSync(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `, [memberId, workspaceId, id, now]);

    return { id, email: cleanEmail, name: cleanName, createdAt: now };
  }
  return createUserAsync(email, password, name);
}

export async function authenticateUserAsync(email: string, password: string): Promise<User | null> {
  const db = getDatabase();
  const row = await db.queryOne<{
    id: string;
    email: string;
    password_hash: string;
    name: string;
    created_at: string;
  }>(`
    SELECT id, email, password_hash, name, created_at
    FROM users
    WHERE email = ?
  `, [email.toLowerCase().trim()]);

  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function authenticateUser(email: string, password: string): User | null;
export function authenticateUser(email: string, password: string): Promise<User | null>;
export function authenticateUser(email: string, password: string): User | null | Promise<User | null> {
  const db = getDatabase();
  if (db.engine === 'sqlite') {
    const row = (db as SqliteDatabaseAdapter).queryOneSync<{
      id: string;
      email: string;
      password_hash: string;
      name: string;
      created_at: string;
    }>(`
      SELECT id, email, password_hash, name, created_at
      FROM users
      WHERE email = ?
    `, [email.toLowerCase().trim()]);

    if (!row) return null;
    if (!verifyPassword(password, row.password_hash)) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
    };
  }
  return authenticateUserAsync(email, password);
}

export async function createSessionAsync(userId: string): Promise<Session> {
  const db = getDatabase();
  const id = `ses_${crypto.randomBytes(24).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const createdAt = now.toISOString();

  await db.execute(`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `, [id, userId, expiresAt, createdAt]);

  return { id, userId, expiresAt, createdAt };
}

export function createSession(userId: string): Session;
export function createSession(userId: string): Promise<Session>;
export function createSession(userId: string): Session | Promise<Session> {
  const db = getDatabase();
  if (db.engine === 'sqlite') {
    const id = `ses_${crypto.randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    const createdAt = now.toISOString();

    (db as SqliteDatabaseAdapter).executeSync(`
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `, [id, userId, expiresAt, createdAt]);

    return { id, userId, expiresAt, createdAt };
  }
  return createSessionAsync(userId);
}

export async function createUserWithSession(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; session: Session }> {
  const db = getDatabase();
  const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
  const workspaceId = `ws_${crypto.randomBytes(10).toString('hex')}`;
  const memberId = `wsm_${crypto.randomBytes(10).toString('hex')}`;
  const sessionId = `ses_${crypto.randomBytes(24).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const createdAt = now.toISOString();
  const passwordHash = hashPassword(password);
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();
  const slugPrefix = cleanEmail.split('@')[0]!.replace(/[^a-z0-9]/g, '-') || 'workspace';
  const slug = `${slugPrefix}-${crypto.randomBytes(3).toString('hex')}`;

  return await db.transaction(async (tx) => {
    await tx.execute(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, cleanEmail, passwordHash, cleanName, createdAt]);

    await tx.execute(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [workspaceId, `${cleanName}'s Workspace`, slug, createdAt, createdAt]);

    await tx.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `, [memberId, workspaceId, userId, createdAt]);

    await tx.execute(`
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, userId, expiresAt, createdAt]);

    return {
      user: { id: userId, email: cleanEmail, name: cleanName, createdAt },
      session: { id: sessionId, userId, expiresAt, createdAt },
    };
  });
}

export async function validateSessionAsync(sessionId: string): Promise<{ user: User; session: Session } | null> {
  const db = getDatabase();
  const row = await db.queryOne<{
    session_id: string;
    user_id: string;
    expires_at: string;
    session_created_at: string;
    email: string;
    name: string;
    user_created_at: string;
  }>(`
    SELECT 
      s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at,
      u.id as user_id, u.email, u.name, u.created_at as user_created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `, [sessionId]);

  if (!row) return null;
  if (isSessionExpired(row.expires_at)) {
    await deleteSessionAsync(sessionId);
    return null;
  }

  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.session_created_at,
    },
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      createdAt: row.user_created_at,
    },
  };
}

export function validateSession(sessionId: string): { user: User; session: Session } | null;
export function validateSession(sessionId: string): Promise<{ user: User; session: Session } | null>;
export function validateSession(sessionId: string): { user: User; session: Session } | null | Promise<{ user: User; session: Session } | null> {
  const db = getDatabase();
  if (db.engine === 'sqlite') {
    const row = (db as SqliteDatabaseAdapter).queryOneSync<{
      session_id: string;
      user_id: string;
      expires_at: string;
      session_created_at: string;
      email: string;
      name: string;
      user_created_at: string;
    }>(`
      SELECT 
        s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at,
        u.id as user_id, u.email, u.name, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `, [sessionId]);

    if (!row) return null;
    if (isSessionExpired(row.expires_at)) {
      deleteSession(sessionId);
      return null;
    }

    return {
      session: {
        id: row.session_id,
        userId: row.user_id,
        expiresAt: row.expires_at,
        createdAt: row.session_created_at,
      },
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        createdAt: row.user_created_at,
      },
    };
  }
  return validateSessionAsync(sessionId);
}

export async function deleteSessionAsync(sessionId: string): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

export function deleteSession(sessionId: string): void;
export function deleteSession(sessionId: string): Promise<void>;
export function deleteSession(sessionId: string): void | Promise<void> {
  const db = getDatabase();
  if (db.engine === 'sqlite') {
    (db as SqliteDatabaseAdapter).executeSync('DELETE FROM sessions WHERE id = ?', [sessionId]);
    return;
  }
  return deleteSessionAsync(sessionId);
}

export function extractSessionId(source?: Request | string | null): string | undefined {
  if (!source) return undefined;
  if (typeof source === 'string') {
    if (source.startsWith('ses_')) return source;
    const match = source.match(/(?:^|;\s*)apiproof_session=([^;]+)/);
    return match ? match[1] : undefined;
  }
  if ('headers' in source && typeof source.headers?.get === 'function') {
    const cookieHeader = source.headers.get('cookie');
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(/(?:^|;\s*)apiproof_session=([^;]+)/);
    return match ? match[1] : undefined;
  }
  return undefined;
}

export async function getCurrentUser(source?: Request | string | null): Promise<User | null> {
  let sessionId = extractSessionId(source);
  if (!sessionId) {
    try {
      const nextHeaders = (await import('next/headers' as string)) as {
        cookies?: () => Promise<{ get: (name: string) => { value?: string } | undefined }>;
      };
      if (nextHeaders && typeof nextHeaders.cookies === 'function') {
        const cookieStore = await nextHeaders.cookies();
        sessionId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      }
    } catch {
      // In standalone test environments or outside Next.js request lifecycle
    }
  }
  if (!sessionId) {
    return null;
  }

  const result = await validateSession(sessionId);
  return result?.user ?? null;
}
