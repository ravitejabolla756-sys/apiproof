import { NextResponse } from 'next/server';
import type { GitHubRepoItem } from '@apiproof/core';
import { getCurrentUser } from '@/lib/server/auth.js';
import { fetchWorkspaceRepositories } from '@/lib/server/github.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: noStoreHeaders });
  }

  let workspaceId: string;
  try {
    workspaceId = (await resolveWorkspaceForRequest(req, user.id)).id;
  } catch (error) {
    const response = organizationErrorResponse(error);
    response.headers.set('Cache-Control', noStoreHeaders['Cache-Control']);
    return response;
  }

  try {
    const result = await fetchWorkspaceRepositories(workspaceId);

    if (!result.connected || !result.installation) {
      return NextResponse.json({
        connected: false,
        repositories: [],
        totalCount: 0,
      }, { headers: noStoreHeaders });
    }

    // Return only minimum sanitized fields needed by the repository picker
    const sanitizedRepositories = result.repositories.map((repo: GitHubRepoItem) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      owner: repo.owner,
      private: repo.private,
      defaultBranch: repo.defaultBranch,
    }));

    return NextResponse.json({
      connected: true,
      installation: {
        id: result.installation.id,
        accountLogin: result.installation.accountLogin,
        accountType: result.installation.accountType,
      },
      repositories: sanitizedRepositories,
      totalCount: sanitizedRepositories.length,
    }, { headers: noStoreHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch repositories from GitHub.';
    if (message.includes('GITHUB_AUTHENTICATION_FAILED')) {
      return NextResponse.json({
        error: 'GitHub authentication failed. Installation access may have been revoked.',
        code: 'GITHUB_AUTH_FAILED',
      }, { status: 502, headers: noStoreHeaders });
    }
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500, headers: noStoreHeaders });
  }
}
