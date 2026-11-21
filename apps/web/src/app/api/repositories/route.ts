import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth.js';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { OrganizationServiceError } from '@/lib/server/organization-service.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { withPostgresTenantContext } from '@/lib/server/db/postgres-tenant-context.js';
import { fetchWorkspaceRepository } from '@/lib/server/github.js';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  requireWorkspaceCapability,
  getWorkspaceGitHubInstallation,
} from '@/lib/server/workspace-service.js';
import {
  assertCsrfProtection,
  validateRepositoryConnectInput,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation.js';
import { checkWorkspaceLimit } from '@/lib/server/billing/service.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const db = getDatabase();
    const sessionId = extractSessionId(req);
    const repos = await withPostgresTenantContext(db, user.id, workspace.id, (tx) => tx.query(`
        SELECT r.id, r.owner, r.name, r.full_name, r.github_repository_id, r.default_branch,
               r.status, r.last_scan_at, r.created_at,
               (SELECT COUNT(*) FROM findings f WHERE f.repository_id = r.id) as findings_count,
               (SELECT COUNT(*) FROM scans s WHERE s.repository_id = r.id) as scans_count,
               (SELECT sha FROM scans s WHERE s.repository_id = r.id ORDER BY s.started_at DESC LIMIT 1) as last_scan_sha
        FROM repositories r
        WHERE r.workspace_id = ? AND r.lifecycle = 'active' AND r.origin = 'connected'
        ORDER BY r.created_at DESC
      `, [workspace.id]), sessionId);
    return NextResponse.json({ repositories: repos }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof OrganizationServiceError || (error instanceof Error && error.message.includes('access denied'))) {
      return organizationErrorResponse(error);
    }
    return NextResponse.json(
      { error: 'Repositories are temporarily unavailable.', code: 'REPOSITORIES_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;

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
      const ws = await requireWorkspaceCapability(user.id, body.workspaceId, 'repository:write');
      workspaceId = ws.id;
    } else {
      const activeWorkspace = await resolveWorkspaceForRequest(req, user.id);
      await requireWorkspaceCapability(user.id, activeWorkspace.id, 'repository:write');
      workspaceId = activeWorkspace.id;
    }

    // Billing plan repository limit check (runs after workspace authorization)
    const limitCheck = await withPostgresTenantContext(
      getDatabase(),
      user.id,
      workspaceId,
      (tx) => checkWorkspaceLimit(workspaceId, 'repositories', tx),
      extractSessionId(req),
    );
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.reason,
        code: 'PLAN_LIMIT_EXCEEDED',
        metric: 'repositories',
        limit: limitCheck.limit,
        current: limitCheck.current,
      }, { status: 402, headers: PRIVATE_NO_STORE_HEADERS });
    }

    let owner: string;
    let name: string;
    let fullName: string;
    let defaultBranch: string;
    let ghId: string;

    if (validation.data.githubRepositoryId) {
      // 1. Verify workspace has a connected GitHub installation
      const installation = await withPostgresTenantContext(
        getDatabase(),
        user.id,
        workspaceId,
        (tx) => getWorkspaceGitHubInstallation(workspaceId, undefined, tx),
        extractSessionId(req),
      );
      if (!installation) {
        return NextResponse.json({
          error: 'Workspace does not have a connected GitHub App installation. Please connect GitHub first.',
          code: 'NO_GITHUB_INSTALLATION',
        }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
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
    const sessionId = extractSessionId(req);

    // Keep all repository identity reads and writes on the same tenant-bound
    // transaction. The GitHub network call above intentionally remains
    // outside this transaction.
    const duplicate = await withPostgresTenantContext(db, user.id, workspaceId, async (tx) => {
      const activeIdentity = await tx.queryOne<{ id: string; workspace_id: string }>(`
        SELECT id, workspace_id
        FROM repositories
        WHERE github_repository_id = ? AND lifecycle = 'active'
        LIMIT 1
      `, [ghId]);
      if (activeIdentity) {
        return { kind: 'identity' as const, id: activeIdentity.id, workspaceId: activeIdentity.workspace_id };
      }

      const existing = await tx.queryOne<{ id: string }>(`
        SELECT id FROM repositories WHERE workspace_id = ? AND full_name = ?
      `, [workspaceId, fullName]);
      if (existing) return { kind: 'workspace' as const, id: existing.id, workspaceId };

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
      return null;
    }, sessionId);

    if (duplicate) {
      const sameWorkspace = duplicate.workspaceId === workspaceId;
      return NextResponse.json(
        {
          error: sameWorkspace ? 'Repository is already connected.' : 'Repository is already connected to another workspace.',
          code: 'REPOSITORY_ALREADY_CONNECTED',
          ...(sameWorkspace ? { id: duplicate.id } : {}),
        },
        { status: 409, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

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
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect repository.';
    if (message.includes('idx_repositories_active_github_identity') || message.includes('unique constraint') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Repository is already connected.', code: 'REPOSITORY_ALREADY_CONNECTED' }, { status: 409, headers: PRIVATE_NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: 'Repository connection could not be completed.', code: 'REPOSITORY_CONNECTION_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
