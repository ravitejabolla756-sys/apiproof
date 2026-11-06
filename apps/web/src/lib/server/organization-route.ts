import { NextResponse } from 'next/server';
import { getDefaultWorkspaceForUser, requireWorkspaceMember, type WorkspaceWithRole } from './workspace-service.js';
import { OrganizationServiceError } from './organization-service.js';
import { validateSafeId } from './validation.js';

export async function resolveWorkspaceForRequest(req: Request, userId: string): Promise<WorkspaceWithRole> {
  const requestedId = new URL(req.url).searchParams.get('workspaceId');
  if (!requestedId) return getDefaultWorkspaceForUser(userId);
  const validation = validateSafeId(requestedId, 'workspaceId');
  if (!validation.valid || !validation.data) throw new Error(validation.error || 'Invalid workspaceId.');
  return requireWorkspaceMember(userId, validation.data);
}

export function organizationErrorResponse(error: unknown): Response {
  if (error instanceof OrganizationServiceError) {
    const status = error.code.endsWith('NOT_FOUND') ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof Error && error.message.includes('access denied')) {
    return NextResponse.json({ error: 'Workspace not found or access denied.', code: 'WORKSPACE_ACCESS_DENIED' }, { status: 404 });
  }
  console.error('Organization request failed:', error);
  return NextResponse.json({ error: 'Workspace request could not be completed.', code: 'WORKSPACE_REQUEST_FAILED' }, { status: 500 });
}
