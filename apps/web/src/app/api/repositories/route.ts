import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { getAccessibleRepositoryInfo } from '@/lib/server/github';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';
import {
  assertCsrfProtection,
  validateRepositoryConnectInput,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = getDatabase();
  const repos = await db.query(`
    SELECT r.id, r.owner, r.name, r.full_name, r.github_repository_id, r.default_branch,
           r.status, r.last_scan_at, r.created_at,
           (SELECT COUNT(*) FROM findings f WHERE f.repository_id = r.id) as findings_count,
           (SELECT COUNT(*) FROM scans s WHERE s.repository_id = r.id) as scans_count,
           (SELECT sha FROM scans s WHERE s.repository_id = r.id ORDER BY s.started_at DESC LIMIT 1) as last_scan_sha
    FROM repositories r
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `, [user.id]);

  const githubInfo = await getAccessibleRepositoryInfo();

  return NextResponse.json({
    repositories: repos,
    githubAppConnection: githubInfo,
  });
}

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Rate limit: 20 repo connections per 10 minutes per user
  const rateCheck = await checkRateLimit(`repo:connect:${user.id}`, 20, 10 * 60 * 1000);
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetInMs);
  }

  try {
    const body = await req.json();
    const validation = validateRepositoryConnectInput(body);
    if (!validation.valid || !validation.data) {
      return badRequestResponse(validation.error || 'Invalid repository connection payload.');
    }

    const { owner, name, defaultBranch, githubRepositoryId } = validation.data;
    const fullName = `${owner}/${name}`;
    const repoId = `repo_${crypto.randomBytes(10).toString('hex')}`;
    const ghId = githubRepositoryId || crypto.randomInt(1000000, 9999999).toString();
    const now = new Date().toISOString();

    const db = getDatabase();

    // Check if already connected (IDOR / tenant scoped)
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM repositories WHERE user_id = ? AND full_name = ?
    `, [user.id, fullName]);

    if (existing) {
      return NextResponse.json(
        { error: 'Repository is already connected.', code: 'REPOSITORY_ALREADY_CONNECTED', id: existing.id },
        { status: 409 }
      );
    }

    // Atomic transaction for repository and activity event creation
    await db.transaction(async (tx) => {
      await tx.execute(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?)
      `, [repoId, user.id, owner, name, fullName, ghId, defaultBranch, now]);

      await tx.execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, 'repository_connected', 'Repository Connected', ?, ?)
      `, [
        `act_${crypto.randomBytes(10).toString('hex')}`,
        user.id,
        repoId,
        `Connected ${fullName} (${defaultBranch}) for AST compatibility analysis.`,
        now
      ]);
    });

    return NextResponse.json({
      success: true,
      repository: {
        id: repoId,
        owner,
        name,
        fullName,
        defaultBranch,
        status: 'connected',
        createdAt: now,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect repository.';
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
