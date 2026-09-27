import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { getAccessibleRepositoryInfo } from '@/lib/server/github';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Also include accessible GitHub App info if available
  const githubInfo = await getAccessibleRepositoryInfo();

  return NextResponse.json({
    repositories: repos,
    githubAppConnection: githubInfo,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { owner, name, defaultBranch, githubRepositoryId } = body;

    if (!owner || !name) {
      return NextResponse.json({ error: 'Owner and repository name are required.' }, { status: 400 });
    }

    const fullName = `${owner.trim()}/${name.trim()}`;
    const branch = defaultBranch?.trim() || 'main';
    const repoId = `repo_${crypto.randomBytes(10).toString('hex')}`;
    const ghId = githubRepositoryId?.toString() || crypto.randomInt(1000000, 9999999).toString();
    const now = new Date().toISOString();

    const db = getDatabase();

    // Check if already connected (IDOR / tenant scoped)
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM repositories WHERE user_id = ? AND full_name = ?
    `, [user.id, fullName]);

    if (existing) {
      return NextResponse.json({ error: 'Repository is already connected.', id: existing.id }, { status: 409 });
    }

    // Atomic transaction for repository and activity event creation
    await db.transaction(async (tx) => {
      await tx.execute(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?)
      `, [repoId, user.id, owner.trim(), name.trim(), fullName, ghId, branch, now]);

      await tx.execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, 'repository_connected', 'Repository Connected', ?, ?)
      `, [
        `act_${crypto.randomBytes(10).toString('hex')}`,
        user.id,
        repoId,
        `Connected ${fullName} (${branch}) for AST compatibility analysis.`,
        now
      ]);
    });

    return NextResponse.json({
      success: true,
      repository: {
        id: repoId,
        owner: owner.trim(),
        name: name.trim(),
        fullName,
        defaultBranch: branch,
        status: 'connected',
        createdAt: now,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect repository.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
