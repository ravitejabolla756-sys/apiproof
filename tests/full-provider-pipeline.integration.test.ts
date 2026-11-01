import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type * as GitHubModule from '../apps/web/src/lib/server/github.js';
import type * as CoreModule from '@apiproof/core';

const { exactSourceFiles } = vi.hoisted(() => ({ exactSourceFiles: new Map<string, string>() }));

vi.mock('../apps/web/src/lib/server/github.js', async (importOriginal) => ({
  ...(await importOriginal<typeof GitHubModule>()),
  fetchRemoteRepositoryFiles: vi.fn(),
}));
vi.mock('@apiproof/core', async (importOriginal) => ({
  ...(await importOriginal<typeof CoreModule>()),
  NodeGitHubAppTokenProvider: vi.fn(function (this: object) { Object.assign(this, { getInstallationToken: vi.fn().mockResolvedValue('ghs_pipeline_test') }); }),
  GitHubAppSourceControlProvider: vi.fn(function (this: object) {
    Object.assign(this, {
      getDefaultBranch: vi.fn().mockResolvedValue({ name: 'main', sha: 'd'.repeat(40) }),
      readTree: vi.fn().mockResolvedValue(Array.from(exactSourceFiles.keys())),
      readFile: vi.fn(async (file: string) => exactSourceFiles.get(file) ?? ''),
    });
  }),
  loadGitHubAppConfig: vi.fn().mockReturnValue({ enabled: true, appId: '12345', appSlug: 'apiproof-pipeline-test', privateKey: 'test-key' }),
}));

import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { fetchRemoteRepositoryFiles } from '../apps/web/src/lib/server/github.js';
import { refreshProviderChangelog } from '../apps/web/src/lib/server/provider-change-monitor.js';
import { approveProviderRuleCandidate, editProviderRuleCandidate } from '../apps/web/src/lib/server/provider-rule-service.js';
import { processRepositoryRescans } from '../apps/web/src/lib/server/repository-rescan-worker.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';
import { FakeGitHubWriteTransport } from '@apiproof/core';
import { grantTestProposalEntitlement } from './helpers.js';

const DB_PATH = path.resolve('.tmp/full-provider-pipeline.integration.db');
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
const resolvePublicHost = async (_hostname: string, _options: { all: true; verbatim: true }): Promise<readonly { address: string }[]> => [{ address: '93.184.216.34' }];

const reviewEvidence = (affected: string, unaffected: string) => ({
  cases: [
    { kind: 'affected', filePath: 'review/affected.ts', code: affected, rationale: 'The reviewed detector token is present in the affected fixture.' },
    { kind: 'unaffected', filePath: 'review/unaffected.ts', code: unaffected, rationale: 'The reviewed detector token is absent from the unaffected fixture.' },
    { kind: 'uncertain', filePath: 'review/uncertain.ts', code: 'const value = maybeDynamicInput;', rationale: 'Dynamic usage remains uncertain and requires human review.' },
  ],
});

type Scenario = {
  providerId: 'openai' | 'firebase' | 'slack';
  email: string;
  repositoryName: string;
  changedSource: string;
  affectedFixture: string;
  unaffectedFixture: string;
  files: Map<string, string>;
};

describe('full provider pipeline integration', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_SLUG = 'apiproof-pipeline-test';
    process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
    vi.mocked(fetchRemoteRepositoryFiles).mockReset();
  });

  afterEach(() => {
    delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    vi.clearAllMocks();
  });

  it('proves changelog-to-finding handoff for OpenAI, Firebase, and Slack with exact-commit rescans', async () => {
    const scenarios: Scenario[] = [
      {
        providerId: 'openai', email: 'pipeline-openai@example.com', repositoryName: 'pipeline-openai',
        changedSource: '<table><tr><td>2027-02-01</td><td><code>old-model</code></td><td><code>current-model</code></td></tr></table>',
        affectedFixture: "client.chat.completions.create({ model: 'old-model' })", unaffectedFixture: "client.chat.completions.create({ model: 'current-model' })",
        files: new Map([
          ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
          ['src/client.ts', "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ model: 'old-model', messages: [] });"],
        ]),
      },
      {
        providerId: 'firebase', email: 'pipeline-firebase@example.com', repositoryName: 'pipeline-firebase',
        changedSource: '<article><h3>2027-05-20</h3><p>Firebase JS SDK deprecation: <code>firebase.database()</code> is no longer supported. Use <code>firebase.firestore()</code>.</p></article>',
        affectedFixture: 'firebase.database()', unaffectedFixture: 'firebase.firestore()',
        files: new Map([
          ['package.json', JSON.stringify({ dependencies: { firebase: '10.0.0' } })],
          ['package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { firebase: '10.0.0' } }, 'node_modules/firebase': { version: '10.0.0' } } })],
          ['src/firebase.ts', "import firebase from 'firebase'; const db = firebase.database();"],
        ]),
      },
      {
        providerId: 'slack', email: 'pipeline-slack@example.com', repositoryName: 'pipeline-slack',
        changedSource: '<article><h3>2027-06-20</h3><p>Slack breaking change: <code>conversations.history</code> is removed. Use <code>conversations.list</code>.</p></article>',
        affectedFixture: 'client.conversations.history({ channel: "C123" })', unaffectedFixture: 'client.conversations.list()',
        files: new Map([
          ['package.json', JSON.stringify({ dependencies: { '@slack/web-api': '7.8.0' } })],
          ['src/slack.ts', "import { WebClient } from '@slack/web-api'; const client = new WebClient(); await client.conversations.history({ channel: 'C123' });"],
        ]),
      },
    ];

    const jobs: Array<{ repositoryId: string; sha: string; changeId: string }> = [];
    for (const [index, scenario] of scenarios.entries()) {
      const { user } = await createUserWithSession(scenario.email, 'Pass1234!', 'Pipeline Test');
      const workspace = await getDefaultWorkspaceForUser(user.id);
      const now = new Date().toISOString();
      await grantTestProposalEntitlement(workspace.id);
      await getDatabase().execute(`INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at) VALUES (?, ?, ?, 'pipeline-test', 'Organization', 'active', ?, ?)`, [id('installation'), workspace.id, String(1_000_000 + index), now, now]);
      const repositoryId = id('repo');
      await getDatabase().execute(`INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES (?, ?, ?, 'pipeline-test', ?, ?, ?, 'main', 'connected', ?)`, [repositoryId, workspace.id, user.id, scenario.repositoryName, `pipeline-test/${scenario.repositoryName}`, String(2_000_000 + index), now]);
      await getDatabase().execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES (?, ?, ?, 'completed', 'multi-provider', ?, ?)`, [id('baseline'), repositoryId, `${index + 1}`.repeat(40), now, now]);

      let sourceBody = `<p>${scenario.providerId} baseline</p>`;
      const fetchImpl = async (): Promise<Response> => new Response(sourceBody, { status: 200, headers: { 'content-type': 'text/html' } });
      const monitorOptions = { fetchImpl, resolveHost: resolvePublicHost };
      expect((await refreshProviderChangelog(scenario.providerId, monitorOptions)).status).toBe('baseline');
      sourceBody = scenario.changedSource;
      const changed = await refreshProviderChangelog(scenario.providerId, monitorOptions);
      expect(changed.status).toBe('changed');
      expect(changed.candidateId).toBeTruthy();

      const candidate = await getDatabase().queryOne<{ id: string; payload_json: string }>('SELECT id, payload_json FROM provider_rule_candidates WHERE provider_id = ?', [scenario.providerId]);
      expect(candidate).toBeTruthy();
      if (scenario.providerId === 'firebase') {
        await editProviderRuleCandidate(candidate!.id, user.id, {
          applicabilityScope: { dimensions: ['provider', 'package', 'package_version', 'operation'] },
          affectedPackages: ['firebase'],
          affectedVersionRange: '>=1.0.0',
          migrationTemplate: {
            transformation: { kind: 'member-rename', from: 'database', to: 'firestore', receiver: 'firebase', preserveArguments: true },
            sources: ['https://firebase.google.com/support/release-notes/js'],
            limitations: ['Only direct firebase.database() member calls are eligible for this verified fixture.'],
          },
        }, 'Bind the reviewed Firebase operation to the package and supported version range.');
      }
      const approval = await approveProviderRuleCandidate(candidate!.id, user.id, `Reviewed official ${scenario.providerId} source and fixtures.`, workspace.id, reviewEvidence(scenario.affectedFixture, scenario.unaffectedFixture));
      expect(approval.repositoriesQueued).toBe(1);
      expect(await getDatabase().queryOne<{ status: string }>('SELECT status FROM provider_rule_candidates WHERE id = ?', [candidate!.id])).toEqual({ status: 'approved' });
      jobs.push({ repositoryId, sha: 'd'.repeat(40), changeId: (JSON.parse(candidate!.payload_json) as { changeId: string }).changeId });

      vi.mocked(fetchRemoteRepositoryFiles).mockResolvedValue({ files: scenario.files, headSha: jobs.at(-1)!.sha, defaultBranch: 'main' });
      const workerResult = await processRepositoryRescans({ batchSize: 1 });
      expect(workerResult.scanWorker).toMatchObject({ jobsClaimed: 1, jobsCompleted: 1, jobsFailed: 0 });
      const scan = await getDatabase().queryOne<{ sha: string; status: string; findings_count: number; raw_result: string }>('SELECT sha, status, findings_count, raw_result FROM scans WHERE repository_id = ? ORDER BY started_at DESC LIMIT 1', [repositoryId]);
      expect(scan).toMatchObject({ sha: jobs.at(-1)!.sha, status: 'completed' });
      expect(scan!.findings_count).toBeGreaterThan(0);
      expect(scan!.raw_result).toContain(jobs.at(-1)!.changeId);
      expect(scan!.raw_result).toContain('AFFECTED');
      expect(await getDatabase().queryOne<{ status: string }>('SELECT status FROM provider_rescan_jobs WHERE repository_id = ?', [repositoryId])).toEqual({ status: 'completed' });

      if (scenario.providerId === 'firebase') {
        const finding = await getDatabase().queryOne<{ id: string; symbol: string; file_path: string; line_number: number }>('SELECT id, symbol, file_path, line_number FROM findings WHERE repository_id = ? LIMIT 1', [repositoryId]);
        expect(finding).toBeTruthy();
        exactSourceFiles.clear();
        for (const [file, content] of scenario.files) exactSourceFiles.set(file, content);
        const migration = await generateMigrationForFinding(finding!.id, user.id);
        const transport = new FakeGitHubWriteTransport('pipeline-test', scenario.repositoryName, 'main', jobs.at(-1)!.sha);
        const proposal = await createGitHubProposal(migration.id, user.id, transport);
        expect(proposal.state).toBe('draft');
        expect(proposal.humanReviewRequired).toBe(true);
        expect(proposal.autoMergeEnabled).toBe(false);
        expect(transport.prs).toHaveLength(1);
        expect(transport.prs[0]?.draft).toBe(true);
        expect(transport.prs[0]?.base).toBe('main');
        expect(transport.prs[0]?.head).toMatch(/^apiproof\//);
        expect(transport.recordedCalls.some((call) => call.method === 'PATCH' && call.path.endsWith('/heads/main'))).toBe(false);
      }
    }

    expect(await getDatabase().query<{ provider: string; change_id: string }>('SELECT provider, change_id FROM findings')).toHaveLength(3);
    expect(new Set((await getDatabase().query<{ provider: string }>('SELECT provider FROM findings')).map((row) => row.provider))).toEqual(new Set(['openai', 'firebase', 'slack']));
    expect(await getDatabase().query<{ id: string }>('SELECT id FROM provider_rule_reviews WHERE decision = \'approved\'')).toHaveLength(3);
    expect(await getDatabase().query<{ id: string }>('SELECT id FROM provider_rescan_jobs WHERE status = \'completed\'')).toHaveLength(3);

  });
});
