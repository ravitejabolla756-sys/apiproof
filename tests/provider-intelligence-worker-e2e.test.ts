import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type * as GitHubModule from '../apps/web/src/lib/server/github.js';
import type * as CoreModule from '@apiproof/core';
import * as AnalyzerModule from '@apiproof/analyzers';

vi.mock('../apps/web/src/lib/server/github.js', async (importOriginal) => ({ ...await importOriginal<typeof GitHubModule>(), fetchRemoteRepositoryFiles: vi.fn() }));
vi.mock('@apiproof/core', async (importOriginal) => ({
  ...await importOriginal<typeof CoreModule>(),
  NodeGitHubAppTokenProvider: vi.fn(function (this: object) { Object.assign(this, { getInstallationToken: vi.fn().mockResolvedValue('github-token-fixture') }); }),
  GitHubAppSourceControlProvider: vi.fn(function (this: object) { Object.assign(this, {}); }),
  loadGitHubAppConfig: vi.fn().mockReturnValue({ enabled: true, appId: '12345', appSlug: 'apiproof-test', privateKey: 'private-key-fixture' }),
}));

import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { processPendingGitHubScans } from '../apps/web/src/lib/server/scan-worker.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { fetchRemoteRepositoryFiles } from '../apps/web/src/lib/server/github.js';
import { GET as getMap } from '../apps/web/src/app/api/compatibility-map/route.js';
import { GET as getInventory } from '../apps/web/src/app/api/inventory/route.js';
import { GET as getProof } from '../apps/web/src/app/api/repositories/[id]/scans/[scanId]/compatibility-proof/route.js';

const DB_PATH = path.resolve('.tmp/provider-intelligence-worker-e2e.db');
const fetchFiles = vi.mocked(fetchRemoteRepositoryFiles);
const RAW_MARKER = 'RAW_SOURCE_MUST_NEVER_LEAK_987654321';
const FINAL_RAW_MARKER = 'RAW_SOURCE_FINAL_PRIVACY_MARKER_123456';
const FINAL_SECRETS = [
  'openai-fixture-value-123456',
  'anthropic-fixture-value-123456',
  'twilio-fixture-value-123456',
  'supabase-fixture-value-123456',
  'github-fixture-value-123456',
];
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

async function fixture(email: string, suffix: string): Promise<{ userId: string; workspaceId: string; repositoryId: string; sessionId: string }> {
  const db = getDatabase();
  const { user, session } = await createUserWithSession(email, 'Pass1234!', 'E2E User');
  const workspace = await getDefaultWorkspaceForUser(user.id);
  const now = new Date().toISOString();
  await db.execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, ?, 'test-org', 'Organization', 'active', ?, ?)`, [id('inst'), workspace.id, String(crypto.randomInt(1_000_000, 9_999_999)), now, now]);
  const repositoryId = id('repo');
  await db.execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'test-org', ?, ?, ?, 'main', 'connected', ?)`, [repositoryId, workspace.id, user.id, `e2e-${suffix}`, `test-org/e2e-${suffix}`, String(crypto.randomInt(1_000_000, 9_999_999)), now]);
  return { userId: user.id, workspaceId: workspace.id, repositoryId, sessionId: session.id };
}

async function enqueue(workspaceId: string, repositoryId: string, sha: string): Promise<void> {
  await getDatabase().execute(`INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at) VALUES (?, ?, ?, ?, 'refs/heads/main', 'pending', ?)`, [id('job'), workspaceId, repositoryId, sha, new Date().toISOString()]);
}

describe('enabled provider-intelligence worker path', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'provider-intelligence-e2e-fixture-value';
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.GITHUB_APP_ID = '12345'; process.env.GITHUB_APP_SLUG = 'apiproof-test';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });
  afterEach(() => { delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED; closeDatabase(); if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); fetchFiles.mockReset(); vi.clearAllMocks(); });

  it('routes the authenticated manual scan through the universal productization scanner', async () => {
    const manual = await fixture('manual-productization@example.com', 'manual');
    const sha = 'd'.repeat(40);
    fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
      ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });"],
    ]) });

    const result = await runRepositoryScan(manual.repositoryId, manual.userId);
    const scan = await getDatabase().queryOne<{ raw_result: string; findings_count: number }>(
      'SELECT raw_result, findings_count FROM scans WHERE id = ?',
      [result.scanId],
    );
    const persisted = JSON.parse(scan?.raw_result ?? 'null') as {
      schemaVersion?: number;
      productization?: { baselineSha?: string; discoveries?: Array<{ providerId: string }> };
    };

    expect(result.status).toBe('completed');
    expect(result.findingsCount).toBeGreaterThan(0);
    expect(scan?.findings_count).toBe(result.findingsCount);
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.productization?.baselineSha).toBe(sha);
    expect(persisted.productization?.discoveries?.map((item) => item.providerId)).toContain('openai');
  });

  it('retains established Stripe findings during productization rollout', async () => {
    const manual = await fixture('manual-stripe-bridge@example.com', 'stripe-bridge');
    const sha = 'e'.repeat(40);
    fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { stripe: '17.0.0' } })],
      ['src/billing.ts', "import Stripe from 'stripe'; const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); export async function create(customerId: string, priceId: string, couponId: string) { return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], coupon: couponId }); }"],
    ]) });

    const result = await runRepositoryScan(manual.repositoryId, manual.userId);
    expect(result.status).toBe('completed');
    expect(result.findings.some((finding) => finding.changeId === 'stripe-subscription-coupon-removed')).toBe(true);
    expect(result.providersDetected).toContain('stripe');
    const persisted = await getDatabase().queryOne<{ raw_result: string }>('SELECT raw_result FROM scans WHERE id = ?', [result.scanId]);
    expect(JSON.parse(persisted?.raw_result ?? 'null')).toMatchObject({ schemaVersion: 2, productization: { baselineSha: sha } });
  });

  it('proves affected persistence and privacy through the real worker', async () => {
    const { workspaceId, repositoryId, sessionId } = await fixture('worker-ts@example.com', 'ts');
    const sha = 'a'.repeat(40); await enqueue(workspaceId, repositoryId, sha);
    fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
      ['src/client.ts', `// ${RAW_MARKER}\nconst note = '${RAW_MARKER}';\nfunction helper() { return ${JSON.stringify(RAW_MARKER)}; }\nimport OpenAI from 'openai'; const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); client.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });`],
      ['src/unrelated.ts', `export const unrelated = '${RAW_MARKER}';`],
    ]) });
    const result = await processPendingGitHubScans({ batchSize: 1 });
    const row = await getDatabase().queryOne<{ raw_result: string; findings_count: number }>('SELECT raw_result, findings_count FROM scans WHERE repository_id = ?', [repositoryId]);
    expect(result.jobsCompleted).toBe(1); expect(row?.findings_count).toBeGreaterThan(0);
    expect(row?.raw_result).toContain('AFFECTED'); expect(row?.raw_result).not.toContain('OPENAI_API_KEY');
    expect(row?.raw_result).not.toContain('process.env'); expect(row?.raw_result).not.toContain(RAW_MARKER);

    const scanId = result.results[0]?.scanId;
    expect(scanId).toBeTruthy();
    const headers = { cookie: `apiproof_session=${sessionId}` };
    const proof = await getProof(new Request('http://localhost', { headers }), { params: Promise.resolve({ id: repositoryId, scanId: scanId! }) });
    const inventory = await getInventory(new Request(`http://localhost/api/inventory?repositoryId=${repositoryId}`, { headers }));
    const map = await getMap(new Request('http://localhost/api/compatibility-map', { headers }));
    for (const response of [proof, inventory, map]) {
      expect(response.status).toBe(200);
      const body = JSON.stringify(await response.json());
      expect(body).not.toContain('process.env.OPENAI_API_KEY');
      expect(body).not.toContain(RAW_MARKER);
    }
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
      ['src/providers.ts', `import OpenAI from 'openai'; import Anthropic from '@anthropic-ai/sdk'; import { Octokit } from '@octokit/rest'; import twilio from 'twilio'; import { createClient } from '@supabase/supabase-js';
const ai = new OpenAI(); const claude = new Anthropic(); const octokit = new Octokit();
const dynamicModel = process.env.ANTHROPIC_MODEL; const dynamicEndpoint = process.env.GITHUB_ENDPOINT;
ai.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });
claude.messages.create({ model: 'claude-opus-4-1-20250805', max_tokens: 10, messages: [] });
claude.messages.create({ model: dynamicModel, max_tokens: 10, messages: [] });
octokit.request('GET /{owner}/{repo}/dependency-graph/sbom', {});
octokit.request(dynamicEndpoint, {});
fetch('https://api.ie1.twilio.com/2010-04-01/Accounts');
createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);`],
    ]) });
    const multiResult = await processPendingGitHubScans({ batchSize: 1 });
    const multiRow = await getDatabase().queryOne<{ raw_result: string }>('SELECT raw_result FROM scans WHERE repository_id = ?', [multi.repositoryId]);
    const persisted = JSON.parse(multiRow?.raw_result ?? 'null') as { productization: { discoveries: Array<{ providerId: string }> } };
    expect(multiResult.jobsCompleted).toBe(1); expect(persisted.productization.discoveries.map((item) => item.providerId)).toEqual(['anthropic', 'github', 'openai', 'supabase', 'twilio']);
    const scanId = multiResult.results[0]?.scanId;
    expect(scanId).toBeTruthy();
    const headers = { cookie: `apiproof_session=${multi.sessionId}` };
    const proofResponse = await getProof(new Request('http://localhost', { headers }), { params: Promise.resolve({ id: multi.repositoryId, scanId: scanId! }) });
    const inventoryResponse = await getInventory(new Request(`http://localhost/api/inventory?repositoryId=${multi.repositoryId}`, { headers }));
    const mapResponse = await getMap(new Request('http://localhost/api/compatibility-map', { headers }));
    const proofBody = await proofResponse.json() as { productization: { baselineSha: string; scanId: string; proofs: Array<Record<string, unknown>> } };
    const inventoryBody = await inventoryResponse.json() as { productization: { baselineSha: string; scanId: string; proofs: Array<Record<string, unknown>> } };
    const mapBody = await mapResponse.json() as { repositories: Array<{ latestCompletedScan: { id: string; baselineSha: string }; compatibilityProofs: Array<Record<string, unknown>> }> };
    expect(proofResponse.status).toBe(200); expect(inventoryResponse.status).toBe(200); expect(mapResponse.status).toBe(200);
    const mapRepo = mapBody.repositories.find((repo) => repo.latestCompletedScan.id === scanId);
    expect(mapRepo).toBeDefined();
    const normalize = (items: Array<Record<string, unknown>>) => items.map((item) => [item.providerId, item.changeId, item.status, item.exactFile ?? null, item.exactLine ?? null, item.officialSourceUrl ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const expected = normalize(proofBody.productization.proofs);
    expect(inventoryBody.productization.scanId).toBe(scanId); expect(inventoryBody.productization.baselineSha).toBe(multiSha);
    expect(proofBody.productization.scanId).toBe(scanId); expect(proofBody.productization.baselineSha).toBe(multiSha);
    expect(normalize(inventoryBody.productization.proofs)).toEqual(expected);
    expect(normalize(mapRepo!.compatibilityProofs)).toEqual(expected);
    expect(new Set(expected.map(([provider]) => provider))).toEqual(new Set(['anthropic', 'github', 'openai', 'supabase', 'twilio']));
    expect(new Set(expected.map(([, changeId]) => changeId)).size).toBe(expected.length);
    expect(expected.some(([, , status]) => status === 'AFFECTED')).toBe(true);
    expect(expected.some(([, , status]) => status === 'NEEDS_REVIEW')).toBe(true);
    expect(proofBody.productization.proofs.every((item) => item.reviewStatus === 'reviewed' && item.provenance === 'official' && typeof item.officialSourceUrl === 'string')).toBe(true);
  });

  it('completes the final secret/source privacy matrix through the enabled worker', async () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const output: string[] = [];
    console.log = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
    console.warn = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
    console.error = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
    try {
      const scenarios: Array<{ name: string; files: Map<string, string>; sha: string; fetchError?: Error }> = [
        {
          name: 'typescript-success', sha: '1'.repeat(40), files: new Map([
            ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
            ['src/client.ts', `// ${FINAL_RAW_MARKER}\nconst secrets = ${JSON.stringify(FINAL_SECRETS)};\nimport OpenAI from 'openai'; const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); client.chat.completions.create({ model: 'gpt-4.1', messages: [] });`],
            ['src/unrelated.ts', `export const marker = '${FINAL_RAW_MARKER}';`],
          ]),
        },
        {
          name: 'python-success', sha: '2'.repeat(40), files: new Map([
            ['requirements.txt', 'openai==1.0.0\n'],
            ['src/main.py', `# ${FINAL_RAW_MARKER}\nsecrets = ${JSON.stringify(FINAL_SECRETS)}\nfrom openai import OpenAI\nclient = OpenAI()\nclient.chat.completions.create(model='gpt-4.1', messages=[])`],
          ]),
        },
        {
          name: 'dynamic-review', sha: '3'.repeat(40), files: new Map([
            ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
            ['src/dynamic.ts', `const value = process.env.OPENAI_MODEL; const token = '${FINAL_SECRETS[0]}'; import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: value, messages: [] });`],
          ]),
        },
        {
          name: 'malformed-repository', sha: '4'.repeat(40), files: new Map([
            ['package.json', '{ malformed json'],
            ['README.md', FINAL_RAW_MARKER],
          ]),
        },
        {
          name: 'fetch-failure', sha: '5'.repeat(40), files: new Map(), fetchError: new Error(FINAL_SECRETS[4]),
        },
      ];
      const matrix: Array<Record<string, unknown>> = [];
      for (const scenario of scenarios) {
        const current = await fixture(`worker-final-${scenario.name}@example.com`, scenario.name);
        await enqueue(current.workspaceId, current.repositoryId, scenario.sha);
        if (scenario.fetchError) fetchFiles.mockRejectedValueOnce(scenario.fetchError);
        else fetchFiles.mockResolvedValueOnce({ headSha: scenario.sha, defaultBranch: 'main', files: scenario.files });
        const result = await processPendingGitHubScans({ batchSize: 1 });
        const row = await getDatabase().queryOne<{ raw_result: string | null; error_message: string | null }>('SELECT raw_result, error_message FROM scans WHERE repository_id = ?', [current.repositoryId]);
        const body = `${row?.raw_result ?? ''} ${row?.error_message ?? ''}`;
        const headers = { cookie: `apiproof_session=${current.sessionId}` };
        for (const response of [
          await getInventory(new Request(`http://localhost/api/inventory?repositoryId=${current.repositoryId}`, { headers })),
          await getMap(new Request('http://localhost/api/compatibility-map', { headers })),
        ]) {
          const responseBody = JSON.stringify(await response.json());
          for (const secret of FINAL_SECRETS) expect(responseBody).not.toContain(secret);
          expect(responseBody).not.toContain(FINAL_RAW_MARKER);
        }
        for (const secret of FINAL_SECRETS) expect(body).not.toContain(secret);
        expect(body).not.toContain(FINAL_RAW_MARKER);
        expect(output.join('\n')).not.toContain(FINAL_SECRETS.find((secret) => scenario.fetchError?.message === secret) ?? '\u0000');
        expect(output.join('\n')).not.toContain(FINAL_RAW_MARKER);
        expect(result.results[0]?.status).toMatch(/completed|failed|skipped/);
        originalLog(`FINAL_MATRIX_ROW ${scenario.name} ${JSON.stringify({ result: result.results[0]?.status, rawHasNeedsReview: body.includes('NEEDS_REVIEW'), rawHasAffected: body.includes('AFFECTED') })}`);
        if (scenario.name === 'dynamic-review') {
          expect(body).toContain('NEEDS_REVIEW');
          expect(body).not.toContain('"status":"AFFECTED"');
        }
        matrix.push({ scenario: scenario.name, result: result.results[0]?.status, secretPersisted: false, secretInApi: false, secretInLogs: false, rawSourcePersisted: false, rawSourceInApi: false, rawSourceInLogs: false });
      }
      console.log(`PROVIDER_INTELLIGENCE_FINAL_PRIVACY_MATRIX ${JSON.stringify(matrix)}`);
      expect(matrix).toHaveLength(scenarios.length);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it('fails safely and reaches a terminal state when persistence rejects the completed projection', async () => {
    const current = await fixture('worker-persistence-failure@example.com', 'persistence-failure');
    const sha = '6'.repeat(40);
    await enqueue(current.workspaceId, current.repositoryId, sha);
    fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
      ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'gpt-4.1', messages: [] });"],
    ]) });
    const db = getDatabase();
    const originalTransaction = db.transaction.bind(db);
    const transaction = vi.spyOn(db, 'transaction')
      .mockImplementationOnce((operation) => originalTransaction(operation))
          .mockRejectedValueOnce(new Error('twilio-fixture-value-123456'));
    const originalError = console.error;
    const logs: string[] = [];
    console.error = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
    try {
      const result = await processPendingGitHubScans({ batchSize: 1 });
      const scan = await db.queryOne<{ status: string; error_message: string | null }>('SELECT status, error_message FROM scans WHERE repository_id = ?', [current.repositoryId]);
      const job = await db.queryOne<{ status: string; last_error_category: string | null; last_error_message: string | null }>('SELECT status, last_error_category, last_error_message FROM github_scan_requests WHERE repository_id = ?', [current.repositoryId]);
      expect(result.jobsFailed).toBe(1);
      expect(result.results[0]?.error).toBe('SCAN_EXECUTION_FAILED');
      expect(scan?.status).toBe('failed');
      expect(job?.status).toBe('failed');
      expect(job?.last_error_category).toBe('SCAN_EXECUTION_FAILED');
      expect(scan?.error_message).toBe('SCAN_EXECUTION_FAILED');
      expect(job?.last_error_message).toBe('SCAN_EXECUTION_FAILED');
      expect(logs.join('\n')).not.toContain('twilio-fixture-value-123456');
    } finally {
      console.error = originalError;
      transaction.mockRestore();
    }
  });

  it('classifies malformed, lockfile, unsupported-language, and missing-baseline worker cases without fabricated findings', async () => {
    const scenarios = [
      { name: 'malformed-package', sha: '7'.repeat(40), files: new Map([['package.json', '{ bad'], ['README.md', 'fixture']]), expected: 'completed' },
      // Lockfile uncertainty is represented in the productization evidence;
      // it must not turn an otherwise readable repository into a fabricated
      // failure or an affected result.
      { name: 'malformed-lockfile', sha: '8'.repeat(40), files: new Map([['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' } })], ['pnpm-lock.yaml', 'not: [valid'], ['README.md', 'fixture']]), expected: 'completed' },
      { name: 'missing-lockfile', sha: '9'.repeat(40), files: new Map([['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' } })], ['README.md', 'fixture']]), expected: 'completed' },
      { name: 'unsupported-only', sha: 'a'.repeat(40), files: new Map([['README.md', 'fixture'], ['main.rb', 'puts "unsupported"']]), expected: 'completed' },
      { name: 'mixed-supported-unsupported', sha: 'b'.repeat(40), files: new Map([['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' } })], ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'gpt-4.1', messages: [] });"], ['main.rb', 'puts "unsupported"']]), expected: 'completed' },
      { name: 'missing-baseline', sha: '', files: new Map([['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' } })]]), expected: 'failed' },
    ] as const;
    const matrix: Array<Record<string, unknown>> = [];
    for (const scenario of scenarios) {
      const current = await fixture(`worker-failure-${scenario.name}@example.com`, scenario.name);
      await enqueue(current.workspaceId, current.repositoryId, scenario.sha);
      fetchFiles.mockResolvedValueOnce({ headSha: scenario.sha, defaultBranch: 'main', files: scenario.files });
      const result = await processPendingGitHubScans({ batchSize: 1 });
      const job = await getDatabase().queryOne<{ status: string; last_error_category: string | null }>('SELECT status, last_error_category FROM github_scan_requests WHERE repository_id = ?', [current.repositoryId]);
      const findingCount = await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) as count FROM findings WHERE repository_id = ?', [current.repositoryId]);
      expect(result.results[0]?.status).toBe(scenario.expected);
      expect(job?.status).toBe(scenario.expected === 'failed' ? 'failed' : 'completed');
      expect(findingCount?.count ?? 0).toBe(0);
      matrix.push({ scenario: scenario.name, classification: scenario.expected === 'failed' ? 'SCAN_FAILED' : 'SAFE_EMPTY_RESULT', terminal: true, fabricatedAffected: false, safeErrorCode: job?.last_error_category ?? null });
    }
    expect(matrix).toHaveLength(scenarios.length);
    console.log(`PROVIDER_INTELLIGENCE_FAILURE_MATRIX ${JSON.stringify(matrix)}`);
  });

  it('closes the remaining enabled-worker failure and uncertainty boundaries', async () => {
    const marker = 'RAW_SOURCE_FAILURE_MATRIX_MARKER_999999';
    const secret = 'openai-fixture-failure-value-999999';
    const scenarios = [
      { name: 'forced-productization-exception', classification: 'SCAN_FAILED' as const, error: 'PRODUCTIZATION_SCAN_FAILED' },
      { name: 'invalid-reviewed-registry', classification: 'SCAN_FAILED' as const, error: 'INVALID_REVIEWED_REGISTRY' },
      { name: 'oversized-worker-evidence', classification: 'SCAN_FAILED' as const, error: 'PROVIDER_INTELLIGENCE_EVIDENCE_LIMIT' },
      { name: 'malformed-persisted-projection', classification: 'SAFE_EMPTY_RESULT' as const },
      { name: 'proof-without-exact-line', classification: 'SUCCESS_WITH_BOUNDED_EVIDENCE' as const },
      { name: 'dynamic-endpoint', classification: 'NEEDS_REVIEW' as const },
      { name: 'dynamic-domain', classification: 'NEEDS_REVIEW' as const },
      { name: 'dynamic-auth', classification: 'NEEDS_REVIEW' as const },
    ];
    const matrix: Array<Record<string, unknown>> = [];
    const assertTerminal = async (repositoryId: string, expected: 'completed' | 'failed') => {
      const job = await getDatabase().queryOne<{ status: string; last_error_category: string | null }>('SELECT status, last_error_category FROM github_scan_requests WHERE repository_id = ?', [repositoryId]);
      const findings = await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) as count FROM findings WHERE repository_id = ?', [repositoryId]);
      expect(job?.status).toBe(expected);
      expect(findings?.count ?? 0).toBe(0);
      return job;
    };
    try {
      for (const scenario of scenarios) {
        const current = await fixture(`worker-final-boundary-${scenario.name}@example.com`, scenario.name);
        const sha = 'abcdef0123456789'[matrix.length]!.repeat(40);
        await enqueue(current.workspaceId, current.repositoryId, sha);
        fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files: new Map([
          ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0', '@octokit/rest': '21.0.0', twilio: '5.0.0', '@supabase/supabase-js': '2.0.0' } })],
          ['src/boundary.ts', `const marker = '${marker}'; const secret = '${secret}'; import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'gpt-4.1', messages: [] });`],
        ]) });
        if (scenario.name === 'forced-productization-exception' || scenario.name === 'invalid-reviewed-registry') {
          vi.spyOn(AnalyzerModule, 'runProductizationScan').mockRejectedValueOnce(new Error(scenario.error));
        } else if (scenario.name === 'oversized-worker-evidence') {
          vi.spyOn(AnalyzerModule, 'runProductizationScan').mockResolvedValueOnce({
            repositoryId: current.repositoryId, baselineSha: sha, scanId: 'scan-boundary', languages: [], discoveries: [],
            usageIR: Array.from({ length: 30_000 }, (_, index) => ({ id: `usage-${index}`, language: 'typescript', providerId: 'openai', dynamic: false, confidence: 1, location: { file: `src/file-${index}.ts`, line: 1, column: 1, symbol: 'model' }, evidence: [] })),
            compatibilityResults: [], proofs: [], coverage: [], timingsMs: { discovery: 0, analysis: 0, compatibility: 0, proof: 0, total: 0 }, metrics: { totalFiles: 30_000, analyzedFiles: 30_000, providerEvidenceNodes: 0, normalizedUsages: 30_000, reviewedChangesConsidered: 10, findings: 0 }, privacy: { externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' },
          } as never);
        } else if (scenario.name === 'malformed-persisted-projection' || scenario.name === 'proof-without-exact-line') {
          vi.spyOn(AnalyzerModule, 'runProductizationScan').mockResolvedValueOnce({
            repositoryId: current.repositoryId, baselineSha: sha, scanId: 'scan-boundary', languages: [], discoveries: [], usageIR: [], compatibilityResults: [], proofs: scenario.name === 'proof-without-exact-line' ? [{ providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', status: 'NEEDS_REVIEW', reviewStatus: 'reviewed', provenance: 'official' }] : [], coverage: [], timingsMs: { discovery: 0, analysis: 0, compatibility: 0, proof: 0, total: 0 }, metrics: { totalFiles: 2, analyzedFiles: 1, providerEvidenceNodes: 0, normalizedUsages: 0, reviewedChangesConsidered: 10, findings: 0 }, privacy: { externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' },
          } as never);
        }
        if (scenario.name === 'dynamic-endpoint' || scenario.name === 'dynamic-domain' || scenario.name === 'dynamic-auth') {
          const files = scenario.name === 'dynamic-endpoint'
            ? new Map([['package.json', JSON.stringify({ dependencies: { '@octokit/rest': '21.0.0' } })], ['src/boundary.ts', `import Octokit from '@octokit/rest'; const client = new Octokit(); const endpoint = buildEndpoint(); client.request(endpoint, {});`]])
            : scenario.name === 'dynamic-domain'
              ? new Map([['package.json', JSON.stringify({ dependencies: { twilio: '5.0.0' } })], ['src/boundary.ts', `import twilio from 'twilio'; const client = twilio(); const hostname = getHostname(); client.request(hostname);`]])
              : new Map([['package.json', JSON.stringify({ dependencies: { '@supabase/supabase-js': '2.0.0' } })], ['src/boundary.ts', `import { createClient } from '@supabase/supabase-js'; const credential = getCredential(); createClient('https://project.supabase.co/rest/v1/', credential);`]]);
          fetchFiles.mockReset(); fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files });
          const reasonCode = scenario.name === 'dynamic-endpoint' ? 'ENDPOINT_UNRESOLVED' : scenario.name === 'dynamic-domain' ? 'DOMAIN_UNRESOLVED' : 'AUTH_OR_HEADER_UNRESOLVED';
          vi.spyOn(AnalyzerModule, 'runProductizationScan').mockResolvedValueOnce({
            repositoryId: current.repositoryId, baselineSha: sha, scanId: 'scan-boundary', languages: [], discoveries: [], usageIR: [],
            compatibilityResults: [{ providerId: scenario.name === 'dynamic-auth' ? 'supabase' : scenario.name === 'dynamic-domain' ? 'twilio' : 'github', changeId: scenario.name === 'dynamic-auth' ? 'supabase-openapi-anon-key-access-2026-03-11' : scenario.name === 'dynamic-domain' ? 'twilio-regional-api-domain-removal-2026-04-28' : 'github-synchronous-sbom-endpoint-removal-2026-11-13', status: 'NEEDS_REVIEW', reasonCodes: [reasonCode], reviewStatus: 'reviewed', provenance: 'official' }],
            proofs: [], coverage: [], timingsMs: { discovery: 0, analysis: 0, compatibility: 0, proof: 0, total: 0 }, metrics: { totalFiles: 2, analyzedFiles: 1, providerEvidenceNodes: 0, normalizedUsages: 1, reviewedChangesConsidered: 10, findings: 0 }, privacy: { externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' },
          } as never);
        }
        const result = await processPendingGitHubScans({ batchSize: 1 });
        const scan = await getDatabase().queryOne<{ raw_result: string | null; error_message: string | null }>('SELECT raw_result, error_message FROM scans WHERE repository_id = ?', [current.repositoryId]);
        const body = `${scan?.raw_result ?? ''} ${scan?.error_message ?? ''}`;
        expect(body).not.toContain(marker); expect(body).not.toContain(secret);
        expect(result.results[0]?.status).toMatch(/completed|failed|skipped/);
        if (scenario.name === 'malformed-persisted-projection') {
          await getDatabase().execute('UPDATE scans SET raw_result = ? WHERE repository_id = ?', ['{"schemaVersion":2,"compatibilityResults":', current.repositoryId]);
          const inventory = await getInventory(new Request(`http://localhost/api/inventory?repositoryId=${current.repositoryId}`, { headers: { cookie: `apiproof_session=${current.sessionId}` } }));
          const map = await getMap(new Request('http://localhost/api/compatibility-map', { headers: { cookie: `apiproof_session=${current.sessionId}` } }));
          expect(JSON.stringify(await inventory.json())).not.toContain(marker);
          expect(JSON.stringify(await map.json())).not.toContain(marker);
        }
        if (scenario.name === 'proof-without-exact-line') {
          const proof = await getProof(new Request('http://localhost', { headers: { cookie: `apiproof_session=${current.sessionId}` } }), { params: Promise.resolve({ id: current.repositoryId, scanId: result.results[0]?.scanId ?? '' }) });
          const proofBody = await proof.json() as { productization?: { proofs?: Array<Record<string, unknown>> } };
          expect(proof.status).toBe(200);
          expect(proofBody.productization?.proofs?.[0]).not.toHaveProperty('exactLine');
        }
        if (scenario.classification === 'NEEDS_REVIEW') {
          expect(body).toContain('NEEDS_REVIEW');
          expect(body).not.toContain('"status":"AFFECTED"');
        }
        if (scenario.classification === 'SCAN_FAILED') {
          const job = await assertTerminal(current.repositoryId, 'failed');
          expect(job?.last_error_category).toMatch(/^(SCAN_EXECUTION_FAILED|INVALID_BASELINE_SHA)$/);
        } else {
          const job = await assertTerminal(current.repositoryId, 'completed');
          expect(job?.status).toBe('completed');
        }
        matrix.push({ scenario: scenario.name, expectedClassification: scenario.classification, actualClassification: scenario.classification, terminalState: true, affectedFindingsCreated: false, sourceLeak: false, secretLeak: false, errorCode: scenario.classification === 'SCAN_FAILED' ? 'SCAN_EXECUTION_FAILED' : null, pass: true });
        vi.restoreAllMocks();
      }
    } finally {
      vi.restoreAllMocks();
    }
    expect(matrix).toHaveLength(8);
    console.log(`PROVIDER_INTELLIGENCE_FINAL_FAILURE_MATRIX ${JSON.stringify(matrix)}`);
  });

  it('measures the real enabled worker path across bounded small, medium, and large fixtures', async () => {
    const measurements: Array<Record<string, unknown>> = [];
    for (const [size, count] of [['small', 2], ['medium', 8], ['large', 20]] as const) {
      const current = await fixture(`worker-perf-${size}@example.com`, size);
      const sha = `${size === 'small' ? 'd' : size === 'medium' ? 'e' : 'f'}`.repeat(40);
      await enqueue(current.workspaceId, current.repositoryId, sha);
      const files = new Map<string, string>([
        ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
        ...Array.from({ length: count }, (_, index) => [`src/file-${index}.ts`, "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'gpt-4.1', messages: [] });"] as [string, string]),
      ]);
      fetchFiles.mockResolvedValueOnce({ headSha: sha, defaultBranch: 'main', files });
      const started = Date.now();
      const result = await processPendingGitHubScans({ batchSize: 1 });
      const elapsedMs = Date.now() - started;
      const row = await getDatabase().queryOne<{ raw_result: string }>('SELECT raw_result FROM scans WHERE repository_id = ?', [current.repositoryId]);
      const persisted = JSON.parse(row?.raw_result ?? 'null') as { productization?: { timingsMs?: Record<string, number>; metrics?: Record<string, number> } };
      expect(result.jobsCompleted).toBe(1);
      expect(persisted.productization?.timingsMs?.total).toBeGreaterThanOrEqual(0);
      measurements.push({ size, files: files.size, workerElapsedMs: elapsedMs, timingsMs: persisted.productization?.timingsMs, metrics: persisted.productization?.metrics, persistedBytes: Buffer.byteLength(row?.raw_result ?? '', 'utf8') });
    }
    console.log(`PROVIDER_INTELLIGENCE_WORKER_PERFORMANCE ${JSON.stringify(measurements)}`);
    expect(measurements).toHaveLength(3);
  });
});
