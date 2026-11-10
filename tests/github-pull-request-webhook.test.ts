import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { claimWebhookDelivery, processGitHubWebhook } from '../apps/web/src/lib/server/github-webhooks.js';

const DB_PATH = path.resolve('.tmp/github-pull-request-webhook.db');

describe('GitHub pull_request webhook synchronization', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'github-pr-webhook-test-secret-over-32-characters';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  async function fixture(email: string) {
    const { user } = await createUserWithSession(email, 'Pass1234!', 'PR Webhook User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    const now = new Date().toISOString();
    const key = crypto.randomBytes(6).toString('hex');
    const installationId = `install_${key}`;
    const repositoryId = `repo_${key}`;
    const githubRepositoryId = `github_${key}`;
    const number = 1000 + Number.parseInt(key.slice(0, 4), 16);
    const scanId = `scan_${key}`;
    const findingId = `finding_${key}`;
    const migrationId = `migration_${key}`;

    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pr-org', 'Organization', 'active', ?, ?)
    `, [`gi_${key}`, workspace.id, installationId, now, now]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
      VALUES (?, ?, ?, 'pr-org', ?, ?, ?, 'main', 'connected', 'connected', 'active', ?)
    `, [repositoryId, workspace.id, user.id, `repo-${key}`, `pr-org/repo-${key}`, githubRepositoryId, now]);
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES (?, ?, 'baseline', 'completed', 'test', ?)
    `, [scanId, repositoryId, now]);
    await db.execute(`
      INSERT INTO findings (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at)
      VALUES (?, ?, ?, ?, 'change', 'stripe', 'Finding', 'Description', 'low', 1, 'src/a.ts', 1, 'symbol', 'pr_created', 'reason', '[]', '[]', ?)
    `, [findingId, scanId, repositoryId, findingId, now]);
    await db.execute(`
      INSERT INTO migrations (id, finding_id, repository_id, plan_id, status, plan_json, created_at)
      VALUES (?, ?, ?, 'plan', 'pr_created', '{}', ?)
    `, [migrationId, findingId, repositoryId, now]);
    await db.execute(`
      INSERT INTO pull_requests (id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, created_at)
      VALUES (?, ?, ?, ?, 'Draft PR', 'apiproof/change', 'main', 'https://github.com/pr-org/repo/pull/1', 'draft', ?)
    `, [`pr_${key}`, migrationId, repositoryId, number, now]);
    return { db, workspaceId: workspace.id, installationId, repositoryId, githubRepositoryId, number };
  }

  function payload(input: {
    action: string;
    installationId: string;
    githubRepositoryId: string;
    number: number;
    state?: 'open' | 'closed';
    draft?: boolean;
    merged?: boolean;
    mergeCommitSha?: string;
  }) {
    return JSON.stringify({
      action: input.action,
      installation: { id: input.installationId },
      repository: { id: input.githubRepositoryId },
      pull_request: {
        number: input.number,
        state: input.state ?? 'open',
        draft: input.draft ?? false,
        merged: input.merged ?? false,
        merge_commit_sha: input.mergeCommitSha ?? null,
      },
    });
  }

  async function deliver(
    local: Awaited<ReturnType<typeof fixture>>,
    action: string,
    state: 'open' | 'closed',
    options: { draft?: boolean; merged?: boolean; mergeCommitSha?: string } = {},
  ) {
    return processGitHubWebhook({
      event: 'pull_request',
      deliveryId: `delivery_${crypto.randomBytes(8).toString('hex')}`,
      rawBody: payload({
        action,
        state,
        installationId: local.installationId,
        githubRepositoryId: local.githubRepositoryId,
        number: local.number,
        ...options,
      }),
    });
  }

  it.each([
    ['opened', 'draft', 'open', true],
    ['ready_for_review', 'open', 'open', false],
    ['closed', 'closed', 'closed', false],
    ['reopened', 'open', 'open', false],
    ['synchronize', 'open', 'open', false],
    ['converted_to_draft', 'draft', 'open', true],
  ] as const)('maps %s to the GitHub reported state', async (action, expected, state, draft) => {
    const local = await fixture(`action-${action}@test.invalid`);
    const result = await deliver(local, action, state, { draft });
    expect(result).toMatchObject({ handled: true, status: expected });
    const row = await local.db.queryOne<{ state: string }>(
      'SELECT state FROM pull_requests WHERE repository_id = ? AND number = ?',
      [local.repositoryId, local.number],
    );
    expect(row?.state).toBe(expected);
  });

  it('records merged as a distinct authoritative closed state', async () => {
    const local = await fixture('merged@test.invalid');
    expect((await deliver(local, 'closed', 'closed', { merged: true, mergeCommitSha: 'a'.repeat(40) })).status).toBe('merged');
  });

  it('queues the actual merged SHA once and preserves the effective result on duplicate deliveries', async () => {
    const local = await fixture('merged-scan@test.invalid');
    const mergeCommitSha = 'b'.repeat(40);
    const first = await deliver(local, 'closed', 'closed', { merged: true, mergeCommitSha });
    const second = await deliver(local, 'closed', 'closed', { merged: true, mergeCommitSha });
    expect(first).toMatchObject({ handled: true, status: 'merged' });
    expect(second).toMatchObject({ handled: true, status: 'merged', scanRequestId: first.scanRequestId });
    expect(await local.db.queryOne<{ merge_sha: string }>('SELECT merge_sha FROM pull_requests WHERE repository_id = ?', [local.repositoryId])).toEqual({ merge_sha: mergeCommitSha });
    expect(await local.db.query('SELECT id FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?', [local.repositoryId, mergeCommitSha])).toHaveLength(1);
    expect(await local.db.query('SELECT id FROM scans WHERE repository_id = ? AND sha = ?', [local.repositoryId, mergeCommitSha])).toHaveLength(1);
  });

  it('does not mark a merge without an authoritative commit SHA as processed work', async () => {
    const local = await fixture('missing-merge-sha@test.invalid');
    const result = await deliver(local, 'closed', 'closed', { merged: true });
    expect(result).toMatchObject({ handled: false, reason: 'invalid_merge_commit_sha' });
    expect(await local.db.query('SELECT id FROM github_scan_requests WHERE repository_id = ?', [local.repositoryId])).toHaveLength(0);
  });

  it('ignores wrong installations and repositories without changing the local PR', async () => {
    const local = await fixture('identity-check@test.invalid');
    const wrongInstallation = await processGitHubWebhook({
      event: 'pull_request', deliveryId: 'wrong_installation',
      rawBody: payload({ action: 'closed', state: 'closed', installationId: 'not-installed', githubRepositoryId: local.githubRepositoryId, number: local.number }),
    });
    expect(wrongInstallation.reason).toBe('installation_not_found');

    const wrongRepository = await processGitHubWebhook({
      event: 'pull_request', deliveryId: 'wrong_repository',
      rawBody: payload({ action: 'closed', state: 'closed', installationId: local.installationId, githubRepositoryId: 'not-in-installation', number: local.number }),
    });
    expect(wrongRepository.reason).toBe('repository_not_in_installation_workspace');
    const row = await local.db.queryOne<{ state: string }>('SELECT state FROM pull_requests WHERE repository_id = ?', [local.repositoryId]);
    expect(row?.state).toBe('draft');
  });

  it('ignores unknown PR numbers safely', async () => {
    const local = await fixture('unknown-pr@test.invalid');
    const result = await processGitHubWebhook({
      event: 'pull_request', deliveryId: 'unknown_pr',
      rawBody: payload({ action: 'closed', state: 'closed', installationId: local.installationId, githubRepositoryId: local.githubRepositoryId, number: local.number + 1 }),
    });
    expect(result.reason).toBe('unmapped_pull_request');
    const row = await local.db.queryOne<{ state: string }>('SELECT state FROM pull_requests WHERE repository_id = ?', [local.repositoryId]);
    expect(row?.state).toBe('draft');
  });

  it('claims duplicate deliveries once and keeps the resulting state idempotent', async () => {
    const local = await fixture('duplicate@test.invalid');
    const deliveryId = 'duplicate_delivery';
    const rawBody = payload({ action: 'closed', state: 'closed', installationId: local.installationId, githubRepositoryId: local.githubRepositoryId, number: local.number });
    expect(await claimWebhookDelivery(deliveryId, 'pull_request', new Date().toISOString())).toBe(true);
    await processGitHubWebhook({ event: 'pull_request', deliveryId, rawBody });
    expect(await claimWebhookDelivery(deliveryId, 'pull_request', new Date().toISOString())).toBe(false);
    const row = await local.db.queryOne<{ state: string }>('SELECT state FROM pull_requests WHERE repository_id = ?', [local.repositoryId]);
    expect(row?.state).toBe('closed');
  });

  it('does not allow an installation from workspace A to mutate workspace B PRs', async () => {
    const workspaceA = await fixture('isolation-a@test.invalid');
    const workspaceB = await fixture('isolation-b@test.invalid');
    const result = await processGitHubWebhook({
      event: 'pull_request', deliveryId: 'workspace_isolation',
      rawBody: payload({ action: 'closed', state: 'closed', installationId: workspaceA.installationId, githubRepositoryId: workspaceB.githubRepositoryId, number: workspaceB.number }),
    });
    expect(result.reason).toBe('repository_not_in_installation_workspace');
    const rowA = await workspaceA.db.queryOne<{ state: string }>('SELECT state FROM pull_requests WHERE repository_id = ?', [workspaceA.repositoryId]);
    const rowB = await workspaceB.db.queryOne<{ state: string }>('SELECT state FROM pull_requests WHERE repository_id = ?', [workspaceB.repositoryId]);
    expect(rowA?.state).toBe('draft');
    expect(rowB?.state).toBe('draft');
  });
});
