import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '../../../lib/server/auth.js';
import { getDatabase, type DatabaseAdapter } from '../../../lib/server/db.js';
import { fetchWorkspaceRepository } from '../../../lib/server/github.js';
import { checkRateLimit, rateLimitResponse } from '../../../lib/server/rate-limit.js';
import {
  getDefaultWorkspaceForUser,
  requireWorkspaceMember,
  getWorkspaceGitHubInstallation,
} from '../../../lib/server/workspace-service.js';
import {
  assertCsrfProtection,
  validateRepositoryConnectInput,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '../../../lib/server/validation.js';
import { checkWorkspaceLimit } from '../../../lib/server/billing/service.js';

export async function GET(req: Request) {
  const privateNoStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: privateNoStoreHeaders });
  }

  const workspace = await getDefaultWorkspaceForUser(user.id);
  const db = getDatabase();
  const repos = await db.query(`
    SELECT r.id, r.owner, r.name, r.full_name, r.github_repository_id, r.default_branch,
           r.status, r.last_scan_at, r.created_at,
           (SELECT COUNT(*) FROM findings f WHERE f.repository_id = r.id) as findings_count,
           (SELECT COUNT(*) FROM scans s WHERE s.repository_id = r.id) as scans_count,
           (SELECT sha FROM scans s WHERE s.repository_id = r.id ORDER BY s.started_at DESC LIMIT 1) as last_scan_sha
    FROM repositories r
    WHERE r.workspace_id = ? AND r.lifecycle = 'active' AND r.origin = 'connected'
    ORDER BY r.created_at DESC
  `, [workspace.id]);

  return NextResponse.json({
    repositories: repos,
  }, { headers: privateNoStoreHeaders });
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
    const body = (await req.json()) as Record<string, unknown>;
    const validation = validateRepositoryConnectInput(body);
    if (!validation.valid || !validation.data) {
      return badRequestResponse(validation.error || 'Invalid repository connection payload.');
    }

    // Resolve target workspace: if provided, verify membership; else use default
    let workspaceId: string;
    if (body.workspaceId && typeof body.workspaceId === 'string') {
      const ws = await requireWorkspaceMember(user.id, body.workspaceId);
      workspaceId = ws.id;
    } else {
      const defaultWs = await getDefaultWorkspaceForUser(user.id);
      workspaceId = defaultWs.id;
    }

    // Billing plan repository limit check (runs after workspace authorization)
    const limitCheck = await checkWorkspaceLimit(workspaceId, 'repositories');
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.reason,
        code: 'PLAN_LIMIT_EXCEEDED',
        metric: 'repositories',
        limit: limitCheck.limit,
        current: limitCheck.current,
      }, { status: 402 });
    }

    let owner: string;
    let name: string;
    let fullName: string;
    let defaultBranch: string;
    let ghId: string;

    if (validation.data.githubRepositoryId) {
      // 1. Verify workspace has a connected GitHub installation
      const installation = await getWorkspaceGitHubInstallation(workspaceId);
      if (!installation) {
        return NextResponse.json({
          error: 'Workspace does not have a connected GitHub App installation. Please connect GitHub first.',
          code: 'NO_GITHUB_INSTALLATION',
        }, { status: 400 });
      }

      // 2. Fetch authoritative repository metadata from GitHub using workspace installation token
      try {
        const repoMeta = await fetchWorkspaceRepository(workspaceId, validation.data.githubRepositoryId);
        owner = repoMeta.owner;
        name = repoMeta.name;
        fullName = repoMeta.fullName;
        defaultBranch = repoMeta.defaultBranch;
        ghId = repoMeta.id;
      } catch {
        return NextResponse.json({
          error: 'Repository not found or not accessible to this workspace GitHub installation.',
          code: 'REPOSITORY_NOT_FOUND',
        }, { status: 404 });
      }
    } else if (validation.data.owner && validation.data.name) {
      // Repository identity must always be established by the authenticated
      // workspace installation. The old owner/name path manufactured a random
      // GitHub ID and could create a production repository with no authoritative
      // GitHub identity. Keep historical rows available for read-only migration
      // compatibility, but never create new ones through this route.
      return NextResponse.json({
        error: 'Repository connection requires an authoritative GitHub repository ID from the workspace installation.',
        code: 'AUTHORITATIVE_REPOSITORY_ID_REQUIRED',
      }, { status: 400 });
    } else {
      return badRequestResponse('Repository githubRepositoryId or owner/name required.');
    }

    const repoId = `repo_${crypto.randomBytes(10).toString('hex')}`;
    const now = new Date().toISOString();

    const db = getDatabase();

    // GitHub repository identity is globally unique among active records. Keep
    // the response deliberately generic so another workspace is not disclosed.
    const activeIdentity = await db.queryOne<{ id: string; workspace_id: string }>(`
      SELECT id, workspace_id
      FROM repositories
      WHERE github_repository_id = ? AND lifecycle = 'active'
      LIMIT 1
    `, [ghId]);
    if (activeIdentity) {
      const sameWorkspace = activeIdentity.workspace_id === workspaceId;
      return NextResponse.json(
        {
          error: sameWorkspace ? 'Repository is already connected.' : 'Repository is already connected to another workspace.',
          code: 'REPOSITORY_ALREADY_CONNECTED',
          ...(sameWorkspace ? { id: activeIdentity.id } : {}),
        },
        { status: 409 }
      );
    }

    // Check if already connected within this workspace (workspace scoped IDOR protection)
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM repositories WHERE workspace_id = ? AND full_name = ?
    `, [workspaceId, fullName]);

    if (existing) {
      return NextResponse.json(
        { error: 'Repository is already connected.', code: 'REPOSITORY_ALREADY_CONNECTED', id: existing.id },
        { status: 409 }
      );
    }

    // Atomic transaction for repository and activity event creation
    await db.transaction(async (tx: DatabaseAdapter) => {
      await tx.execute(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)
      `, [repoId, workspaceId, user.id, owner, name, fullName, ghId, defaultBranch, now]);

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
        workspaceId,
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
    if (message.includes('idx_repositories_active_github_identity') || message.includes('unique constraint') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Repository is already connected.', code: 'REPOSITORY_ALREADY_CONNECTED' }, { status: 409 });
    }
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
