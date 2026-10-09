import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';
import pg from 'pg';
import {
  FetchGitHubReadTransport,
  GitHubAppSourceControlProvider,
  NodeGitHubAppTokenProvider,
  type GitHubAppConfig,
  type GitHubOperation,
} from '@apiproof/core';

const { Pool } = pg;

export const STAGING_OPENAI_TARGET = Object.freeze({
  projectRef: 'elzkxgfsciivlrejujwb',
  databaseUrlUsername: 'postgres.elzkxgfsciivlrejujwb',
  databaseName: 'postgres',
  databaseSessionUser: 'postgres',
  owner: 'ravitejabolla756-sys',
  repository: 'my-owl-staging-affected-openai',
  repositoryId: '1408947921',
  branch: 'main',
});

export interface StagingOpenAIInput {
  databaseUrl: string;
  appId: string;
  installationId: string;
  privateKey?: string;
  privateKeyPath?: string;
}

export interface ReadOnlyQueryClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface ReadOnlyClient extends ReadOnlyQueryClient {
  release?: () => void;
}

export interface ReadOnlyPool extends ReadOnlyQueryClient {
  connect(): Promise<ReadOnlyClient>;
  end(): Promise<void>;
}

export interface StagingDatabaseCheck {
  projectRef: string;
  currentUser: string;
  currentDatabase: string;
  repositoryCount: number;
  exactRepositoryCount: number;
  installationCount: number;
  exactActiveInstallationCount: number;
  pendingOrProcessingCount: number;
}

export interface StagingOpenAIVerificationResult {
  database: StagingDatabaseCheck;
  github: {
    repositoryId: string;
    owner: string;
    repository: string;
    branch: string;
    commitSha: string;
    fixtureSource: 'PASS';
    writes: 'BLOCKED';
  };
}

export class StagingVerificationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StagingVerificationError';
  }
}

function fail(code: string): never {
  throw new StagingVerificationError(code);
}

export function validateStagingDatabaseUrl(databaseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('STAGING_DATABASE_URL_INVALID');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') fail('STAGING_DATABASE_URL_INVALID');
  if (!parsed.hostname.endsWith('.supabase.com') && !parsed.hostname.endsWith('.supabase.co')) fail('STAGING_DATABASE_HOST_INVALID');
  if (decodeURIComponent(parsed.username) !== STAGING_OPENAI_TARGET.databaseUrlUsername) fail('STAGING_PROJECT_REF_MISMATCH');
  if (decodeURIComponent(parsed.pathname.slice(1)) !== STAGING_OPENAI_TARGET.databaseName) fail('STAGING_DATABASE_NAME_MISMATCH');
  if (parsed.searchParams.get('sslmode')?.toLowerCase() === 'disable') fail('STAGING_TLS_DISABLE_REFUSED');
  return parsed;
}

async function one<T>(client: ReadOnlyQueryClient, sql: string, params: unknown[] = []): Promise<T> {
  const result = await client.query<T>(sql, params);
  const row = result.rows[0];
  if (!row) fail('STAGING_DATABASE_RESPONSE_INVALID');
  return row;
}

export async function verifyStagingDatabase(
  pool: ReadOnlyPool,
  databaseUrl: string,
  installationId: string,
): Promise<StagingDatabaseCheck> {
  validateStagingDatabaseUrl(databaseUrl);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    const identity = await one<{ current_user: string; current_database: string }>(
      client,
      'SELECT current_user AS current_user, current_database() AS current_database',
    );
    const repositories = await one<{ count: number | string }>(client, 'SELECT COUNT(*)::int AS count FROM repositories');
    const exactRepository = await one<{ count: number | string }>(client, `
      SELECT COUNT(*)::int AS count FROM repositories
      WHERE owner = $1 AND name = $2 AND github_repository_id = $3
        AND default_branch = $4 AND lifecycle = 'active'
    `, [STAGING_OPENAI_TARGET.owner, STAGING_OPENAI_TARGET.repository, STAGING_OPENAI_TARGET.repositoryId, STAGING_OPENAI_TARGET.branch]);
    const installations = await one<{ count: number | string }>(client, 'SELECT COUNT(*)::int AS count FROM github_installations');
    const exactInstallation = await one<{ count: number | string }>(client, `
      SELECT COUNT(*)::int AS count
      FROM github_installations
      WHERE account_login = $1 AND installation_id = $2 AND status = 'active'
    `, [STAGING_OPENAI_TARGET.owner, installationId]);
    const queued = await one<{ count: number | string }>(client, `
      SELECT COUNT(*)::int AS count
      FROM github_scan_requests
      WHERE status IN ('pending', 'processing')
    `);

    if (identity.current_user !== STAGING_OPENAI_TARGET.databaseSessionUser
      || identity.current_database !== STAGING_OPENAI_TARGET.databaseName) fail('STAGING_SQL_IDENTITY_MISMATCH');

    const result = {
      projectRef: STAGING_OPENAI_TARGET.projectRef,
      currentUser: identity.current_user,
      currentDatabase: identity.current_database,
      repositoryCount: Number(repositories.count),
      exactRepositoryCount: Number(exactRepository.count),
      installationCount: Number(installations.count),
      exactActiveInstallationCount: Number(exactInstallation.count),
      pendingOrProcessingCount: Number(queued.count),
    } satisfies StagingDatabaseCheck;

    if (result.repositoryCount !== 1 || result.exactRepositoryCount !== 1
      || result.installationCount !== 1 || result.exactActiveInstallationCount !== 1
      || result.pendingOrProcessingCount !== 0) fail('STAGING_RECORD_GATE_FAILED');

    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the safe failure code */ }
    if (error instanceof StagingVerificationError) throw error;
    throw new StagingVerificationError('STAGING_DATABASE_READ_FAILED');
  } finally {
    client.release?.();
  }
}

function fixtureMatches(source: string): boolean {
  return /import\s+OpenAI(?:\s+from\s+|\s*,[\s\S]*?from\s+)["']openai["']/.test(source)
    && /\bclient\s*\.\s*responses\s*\.\s*create\s*\(/.test(source)
    && /\bmodel\s*:\s*["']gpt-4\.5-preview["']/.test(source);
}

export async function verifyStagingOpenAI(
  input: StagingOpenAIInput,
  dependencies: {
    pool: ReadOnlyPool;
    github: Pick<GitHubAppSourceControlProvider, 'getRepository' | 'getDefaultBranch' | 'readFile' | 'operationAllowed'>;
  },
): Promise<StagingOpenAIVerificationResult> {
  validateStagingDatabaseUrl(input.databaseUrl);
  if (!/^\d+$/.test(input.appId)) fail('GITHUB_APP_ID_INVALID');
  if (!/^\d+$/.test(input.installationId)) fail('GITHUB_INSTALLATION_ID_INVALID');
  if (!input.privateKey && !input.privateKeyPath) fail('GITHUB_PRIVATE_KEY_INPUT_MISSING');

  const database = await verifyStagingDatabase(dependencies.pool, input.databaseUrl, input.installationId);
  const identity = await dependencies.github.getRepository();
  const head = await dependencies.github.getDefaultBranch();
  if (identity.repositoryId !== STAGING_OPENAI_TARGET.repositoryId
    || identity.owner !== STAGING_OPENAI_TARGET.owner
    || identity.repository !== STAGING_OPENAI_TARGET.repository
    || head.name !== STAGING_OPENAI_TARGET.branch) fail('GITHUB_REPOSITORY_IDENTITY_MISMATCH');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head.sha)) fail('GITHUB_COMMIT_SHA_INVALID');

  const source = await dependencies.github.readFile('src/index.ts', head.sha);
  if (!fixtureMatches(source)) fail('OPENAI_FIXTURE_SOURCE_MISMATCH');
  if (dependencies.github.operationAllowed('CREATE_APIPROOF_BRANCH' as GitHubOperation)
    || dependencies.github.operationAllowed('CREATE_PULL_REQUEST' as GitHubOperation)) fail('GITHUB_WRITE_CAPABILITY_PRESENT');

  return {
    database,
    github: {
      repositoryId: identity.repositoryId,
      owner: identity.owner,
      repository: identity.repository,
      branch: head.name,
      commitSha: head.sha,
      fixtureSource: 'PASS',
      writes: 'BLOCKED',
    },
  };
}

function readLinePrompt(label: string): Promise<string> {
  const readline = createInterface({ input: defaultInput, output: defaultOutput });
  return readline.question(`${label}: `).finally(() => readline.close());
}

async function readSecretPrompt(label: string): Promise<string> {
  if (!defaultInput.isTTY || typeof defaultInput.setRawMode !== 'function') fail('SECURE_PROMPT_UNAVAILABLE');
  defaultOutput.write(`${label}: `);
  let value = '';
  const input = defaultInput;
  const previousEncoding = input.readableEncoding;
  input.setEncoding('utf8');
  input.setRawMode(true);
  input.resume();
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        input.removeListener('data', onData);
        input.removeListener('end', onEnd);
        input.removeListener('error', onError);
      };
      const finishResolve = () => { cleanup(); resolve(); };
      const finishReject = (error: Error) => { cleanup(); reject(error); };
      const onData = (chunk: string) => {
        for (const character of chunk) {
          if (character === '\u0003') { finishReject(new StagingVerificationError('SECURE_PROMPT_CANCELLED')); return; }
          if (character === '\r' || character === '\n') { finishResolve(); return; }
          if (character === '\b' || character === '\u007f') { value = value.slice(0, -1); continue; }
          value += character;
        }
      };
      const onEnd = () => finishReject(new StagingVerificationError('SECURE_PROMPT_ENDED'));
      const onError = (error: Error) => finishReject(error);
      input.on('data', onData);
      input.once('end', onEnd);
      input.once('error', onError);
    });
  } finally {
    input.setRawMode(false);
    if (previousEncoding) input.setEncoding(previousEncoding);
    defaultOutput.write('\n');
  }
  if (!value.trim()) fail('SECURE_PROMPT_EMPTY');
  return value.trim();
}

async function collectInput(): Promise<StagingOpenAIInput> {
  if (process.env.DATABASE_URL?.trim() || process.env.APIPROOF_DATABASE_URL?.trim()) fail('GENERIC_DATABASE_VARIABLE_REFUSED');
  const databaseUrl = process.env.APIPROOF_STAGING_DATABASE_URL?.trim() || await readSecretPrompt('Staging database URL');
  const appId = process.env.GITHUB_APP_ID?.trim() || await readLinePrompt('GitHub App ID');
  const installationId = process.env.GITHUB_INSTALLATION_ID?.trim() || await readLinePrompt('GitHub installation ID');
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH?.trim() || await readLinePrompt('Path to GitHub App private key');
  if (!privateKey && !privateKeyPath) fail('GITHUB_PRIVATE_KEY_INPUT_MISSING');
  return { databaseUrl, appId, installationId, privateKey, privateKeyPath };
}

async function createPool(databaseUrl: string): Promise<ReadOnlyPool> {
  validateStagingDatabaseUrl(databaseUrl);
  return new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true },
  }) as unknown as ReadOnlyPool;
}

async function main(): Promise<void> {
  let pool: ReadOnlyPool | undefined;
  try {
    const input = await collectInput();
    pool = await createPool(input.databaseUrl);
    const config: GitHubAppConfig = {
      enabled: true,
      writeEnabled: false,
      appId: input.appId,
      privateKey: input.privateKey,
      privateKeyPath: input.privateKeyPath,
      installationId: input.installationId,
      repositoryId: STAGING_OPENAI_TARGET.repositoryId,
      owner: STAGING_OPENAI_TARGET.owner,
      repository: STAGING_OPENAI_TARGET.repository,
      mode: 'OBSERVE',
    };
    const tokenProvider = new NodeGitHubAppTokenProvider(config);
    const github = new GitHubAppSourceControlProvider(config, tokenProvider, new FetchGitHubReadTransport());
    const result = await verifyStagingOpenAI(input, { pool, github });
    console.log('DATABASE_IDENTITY=PASS');
    console.log(`REPOSITORY_COUNT=${result.database.repositoryCount}`);
    console.log(`EXACT_REPOSITORY_COUNT=${result.database.exactRepositoryCount}`);
    console.log(`INSTALLATION_COUNT=${result.database.installationCount}`);
    console.log(`EXACT_ACTIVE_INSTALLATION_COUNT=${result.database.exactActiveInstallationCount}`);
    console.log(`PENDING_OR_PROCESSING_COUNT=${result.database.pendingOrProcessingCount}`);
    console.log('GITHUB_APP_REPOSITORY_ACCESS=PASS');
    console.log(`TARGET_COMMIT_SHA=${result.github.commitSha}`);
    console.log('FIXTURE_SOURCE=PASS');
    console.log('GITHUB_WRITES=BLOCKED');
    console.log('OPENAI_PRE_SCAN_VERIFICATION=PASS');
  } catch (error) {
    const code = error instanceof StagingVerificationError ? error.code : 'OPENAI_PRE_SCAN_VERIFICATION_FAILED';
    console.error(`OPENAI_PRE_SCAN_VERIFICATION=FAIL`);
    console.error(`REASON=${code}`);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
