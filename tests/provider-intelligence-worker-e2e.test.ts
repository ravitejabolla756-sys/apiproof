import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type * as GitHubModule from '../apps/web/src/lib/server/github.js';
import type * as CoreModule from '@apiproof/core';

vi.mock('../apps/web/src/lib/server/github.js', async (importOriginal) => ({ ...await importOriginal<typeof GitHubModule>(), fetchRemoteRepositoryFiles: vi.fn() }));
vi.mock('@apiproof/core', async (importOriginal) => ({
  ...await importOriginal<typeof CoreModule>(),
  NodeGitHubAppTokenProvider: vi.fn(function (this: object) { Object.assign(this, { getInstallationToken: vi.fn().mockResolvedValue('ghs_mock_token') }); }),
  GitHubAppSourceControlProvider: vi.fn(function (this: object) { Object.assign(this, {}); }),
  loadGitHubAppConfig: vi.fn().mockReturnValue({ enabled: true, appId: '12345', appSlug: 'apiproof-test', privateKey: '-----BEGIN RSA PRIVATE KEY-----\nplaceholder\n-----END RSA PRIVATE KEY-----' }),
}));

import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { processPendingGitHubScans } from '../apps/web/src/lib/server/scan-worker.js';
import { fetchRemoteRepositoryFiles } from '../apps/web/src/lib/server/github.js';

const DB_PATH = path.resolve('.tmp/provider-intelligence-worker-e2e.db');
const fetchFiles = vi.mocked(fetchRemoteRepositoryFiles);
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

async function fixture(email: string, suffix: string): Promise<{ workspaceId: string; repositoryId: string }> {
  const db = getDatabase();
  const { user } = await createUserWithSession(email, 'Pass1234!', 'E2E User');
  const workspace = await getDefaultWorkspaceForUser(user.id);
  const now = new Date().toISOString();
  await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, ?, 'test-org', 'Organization', 'active', ?, ?)`, [id('inst'), workspace.id, String(crypto.randomInt(1_000_000, 9_999_999)), now, now]);
  const repositoryId = id('repo');
  await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'test-org', ?, ?, ?, 'main', 'connected', ?)`, [repositoryId, workspace.id, user.id, `e2e-${suffix}`, `test-org/e2e-${suffix}`, String(crypto.randomInt(1_000_000, 9_999_999)), now]);
  return { workspaceId: workspace.id, repositoryId };
}

async function enqueue(workspaceId: string, repositoryId: string, sha: string): Promise<void> {
  await getDatabase().execute(`INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at) VALUES (?, ?, ?, ?, 'refs/heads/main', 'pending', ?)`, [id('job'), workspaceId, repositoryId, sha, new Date().toISOString()]);
}

describe('enabled provider-intelligence worker path', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'provider-intelligence-e2e-secret-minimum-32-chars';
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.GITHUB_APP_ID = '12345'; process.env.GITHUB_APP_SLUG = 'apiproof-test';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });
  afterEach(() => { delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED; closeDatabase(); if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); vi.clearAllMocks(); });

  it('proves affected persistence and privacy through the real worker', async () => {
    const { workspaceId, repositoryId } = await fixture('worker-ts@example.com', 'ts');
    const sha = 'a'.repeat(40); await enqueue(workspaceId, repositoryId, sha);
    fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
      ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); client.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });"],
    ]) });
    const result = await processPendingGitHubScans({ batchSize: 1 });
    const row = await getDatabase().queryOne<{ raw_result: string; findings_count: number }>('SELECT raw_result, findings_count FROM scans WHERE repository_id = ?', [repositoryId]);
    expect(result.jobsCompleted).toBe(1); expect(row?.findings_count).toBeGreaterThan(0);
    expect(row?.raw_result).toContain('AFFECTED'); expect(row?.raw_result).not.toContain('OPENAI_API_KEY');
    expect(row?.raw_result).not.toContain('process.env');
  });

  it('proves Python model applicability and five-provider discovery through the same worker', async () => {
    const python = await fixture('worker-python@example.com', 'python'); const pySha = 'b'.repeat(40); await enqueue(python.workspaceId, python.repositoryId, pySha);
    fetchFiles.mockResolvedValueOnce({ headSha: pySha, defaultBranch: 'main', files: new Map([['requirements.txt', 'openai==1.0.0\n'], ['src/main.py', "from openai import OpenAI\nclient = OpenAI()\nclient.chat.completions.create(model='gpt-4.5-preview', messages=[])\n"]]) });
    const pyResult = await processPendingGitHubScans({ batchSize: 1 });
    const pyRow = await getDatabase().queryOne<{ raw_result: string }>('SELECT raw_result FROM scans WHERE repository_id = ?', [python.repositoryId]);
    expect(pyResult.jobsCompleted).toBe(1); expect(pyRow?.raw_result).toContain('AFFECTED');

    const multi = await fixture('worker-five@example.com', 'five'); const multiSha = 'c'.repeat(40); await enqueue(multi.workspaceId, multi.repositoryId, multiSha);
    fetchFiles.mockResolvedValueOnce({ headSha: multiSha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0', '@anthropic-ai/sdk': '0.30.0', '@octokit/rest': '21.0.0', twilio: '5.0.0', '@supabase/supabase-js': '2.0.0' } })],
      ['src/providers.ts', "import OpenAI from 'openai'; import Anthropic from '@anthropic-ai/sdk'; import { Octokit } from '@octokit/rest'; import twilio from 'twilio'; import { createClient } from '@supabase/supabase-js'; const ai = new OpenAI(); const claude = new Anthropic(); const octokit = new Octokit(); ai.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] }); claude.messages.create({ model: 'claude-opus-4-1-20250805', max_tokens: 10, messages: [] }); octokit.request('GET /{owner}/{repo}/dependency-graph/sbom', {}); fetch('https://api.ie1.twilio.com/2010-04-01/Accounts'); createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);"],
    ]) });
    const multiResult = await processPendingGitHubScans({ batchSize: 1 });
    const multiRow = await getDatabase().queryOne<{ raw_result: string }>('SELECT raw_result FROM scans WHERE repository_id = ?', [multi.repositoryId]);
    const persisted = JSON.parse(multiRow?.raw_result ?? 'null') as { productization: { discoveries: Array<{ providerId: string }> } };
    expect(multiResult.jobsCompleted).toBe(1); expect(persisted.productization.discoveries.map((item) => item.providerId)).toEqual(['anthropic', 'github', 'openai', 'supabase', 'twilio']);
  });
});
