import { NextResponse } from 'next/server';
import { getDefaultWorkspaceForUser, isWorkspaceAuthorizationError, requireWorkspaceMember, type WorkspaceWithRole } from './workspace-service.js';
import { OrganizationServiceError } from './organization-service.js';
import { validateSafeId } from './validation.js';

export const WORKSPACE_CONTEXT_COOKIE = 'apiproof_workspace_id';
export const PRIVATE_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

function readCookieValue(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const pair = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) || null : null;
}

export async function resolveWorkspaceForRequest(req: Request, userId: string, requestedWorkspaceId?: string): Promise<WorkspaceWithRole> {
  const explicitId = requestedWorkspaceId ?? new URL(req.url).searchParams.get('workspaceId');
  if (explicitId) {
    const validation = validateSafeId(explicitId, 'workspaceId');
    if (!validation.valid || !validation.data) throw new OrganizationServiceError(validation.error || 'Invalid workspaceId.', 'INVALID_WORKSPACE_ID');
    return requireWorkspaceMember(userId, validation.data);
  }

  const contextId = readCookieValue(req, WORKSPACE_CONTEXT_COOKIE);
  if (contextId) {
    const validation = validateSafeId(contextId, 'workspaceId');
    if (validation.valid && validation.data) {
      try {
        return await requireWorkspaceMember(userId, validation.data);
      } catch (error) {
        // A workspace can be revoked between requests. Treat a stale browser
        // context as recoverable and fall back to the user's authorized default.
        if (!(error instanceof Error) || !error.message.includes('access denied')) throw error;
      }
    }
  }

  return getDefaultWorkspaceForUser(userId);
}

export function organizationErrorResponse(error: unknown): Response {
  if (error instanceof OrganizationServiceError) {
    const status = error.code === 'ORGANIZATION_SCHEMA_UNAVAILABLE' ? 503 : error.code.endsWith('NOT_FOUND') ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status, headers: PRIVATE_NO_STORE_HEADERS });
  }
  if (isWorkspaceAuthorizationError(error)) {
    const accessDenied = error instanceof Error && (
      error.message === 'Workspace not found or access denied.' || error.message === 'WORKSPACE_ROLE_INVALID'
    );
    return NextResponse.json(
      {
        error: accessDenied ? 'Workspace not found or access denied.' : 'You do not have permission to perform this workspace action.',
        code: accessDenied ? 'WORKSPACE_ACCESS_DENIED' : 'WORKSPACE_CAPABILITY_DENIED',
      },
      { status: accessDenied ? 404 : 403, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (error instanceof Error && error.message.includes('access denied')) {
    return NextResponse.json(
      { error: 'Workspace not found or access denied.', code: 'WORKSPACE_ACCESS_DENIED' },
      { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  console.error('Organization request failed:', error);
  return NextResponse.json(
    { error: 'Workspace request could not be completed.', code: 'WORKSPACE_REQUEST_FAILED' },
    { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
  );
}
