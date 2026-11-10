import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getGitHubRepositories } from '../apps/web/src/app/api/github/repositories/route.js';
import * as githubService from '../apps/web/src/lib/server/github.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';

const DB_PATH = path.resolve('.tmp/github-repositories-error-safety.db');

describe('GitHub repositories API error safety', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'github-repositories-error-safety-secret-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('hides unexpected repository service details while preserving safe auth mapping', async () => {
    const { session } = await createUserWithSession('github-repositories-error@example.test', 'StrongPassword123!', 'GitHub Repositories Error');
    const secretMarker = 'AWS_SECRET_ACCESS_KEY:GITHUB_REPOSITORIES_SECRET';
    vi.spyOn(githubService, 'fetchWorkspaceRepositories').mockRejectedValue(new Error(secretMarker));

    const response = await getGitHubRepositories(new Request('https://apiproof.test/api/github/repositories', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toEqual({ error: 'Failed to fetch repositories from GitHub.', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain(secretMarker);
  });
});
