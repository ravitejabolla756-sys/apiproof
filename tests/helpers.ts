import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'vitest';
import { ApiProof } from '@apiproof/core';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { StripeProvider } from '@apiproof/providers';
import { getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const fixture = (name: string) => path.join(root, 'test-fixtures', name);
export const provider = new StripeProvider();
export const proof = new ApiProof(new TypeScriptRepositoryAnalyzer(), provider);
export const change: unknown = JSON.parse(await readFile(path.join(root, 'fixtures/stripe-change.json'), 'utf8'));

/**
 * Give historical proposal fixtures explicit legacy capacity.
 *
 * The public beta plans intentionally disable repository writes. These tests
 * cover the historical proposal/recovery code paths, so they use the
 * non-public enterprise fixture plan rather than weakening the launch plans.
 */
export async function grantTestProposalEntitlement(workspaceId: string): Promise<void> {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const timestamp = now.toISOString();
  await getDatabase().execute(`
    INSERT INTO workspace_subscriptions (
      workspace_id, plan_id, customer_id, subscription_id, status,
      current_period_start, current_period_end, created_at, updated_at
    ) VALUES (?, 'enterprise', NULL, NULL, 'active', ?, ?, ?, ?)
    ON CONFLICT (workspace_id) DO UPDATE SET
      plan_id = 'enterprise',
      status = 'active',
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `, [workspaceId, periodStart, periodEnd, timestamp, timestamp]);
}

export async function getProposalWorkspaceForUser(userId: string) {
  const workspace = await getDefaultWorkspaceForUser(userId);
  await grantTestProposalEntitlement(workspace.id);
  return workspace;
}

const temporary: string[] = [];
afterEach(async () => {
  for (const directory of temporary.splice(0)) {
    // Only remove directories created by this test process under its temp root.
    if (!path.resolve(directory).startsWith(path.join(tmpdir(), 'apiproof-test-'))) throw new Error('Unsafe cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});

export async function repository(files: Record<string, string> = {}): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'apiproof-test-'));
  temporary.push(directory);
  const contents = { 'package.json': '{"name":"test","dependencies":{"stripe":"^16.0.0"}}', ...files };
  for (const [file, content] of Object.entries(contents)) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return directory;
}
