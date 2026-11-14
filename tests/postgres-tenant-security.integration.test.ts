import { readFile } from 'node:fs/promises';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PostgresDatabaseAdapter } from '../apps/web/src/lib/server/db/postgres-adapter.js';
import { withPostgresTenantContext } from '../apps/web/src/lib/server/db/postgres-tenant-context.js';

const adminUrl = process.env.TEST_POSTGRES_ADMIN_URL;
const enabled = Boolean(adminUrl);
const suite = enabled ? describe : describe.skip;

const appRole = process.env.TEST_POSTGRES_APP_ROLE ?? 'apiproof_ci_app';
const appPassword = process.env.TEST_POSTGRES_APP_PASSWORD ?? 'apiproof-ci-app-password';
const migratorRole = process.env.TEST_POSTGRES_MIGRATOR_ROLE ?? 'apiproof_ci_migrator';
const migratorPassword = process.env.TEST_POSTGRES_MIGRATOR_PASSWORD ?? 'apiproof-ci-migrator-password';

const appConnectionString = (base: string, role: string, password: string): string => {
  const url = new URL(base);
  url.username = role;
  url.password = password;
  return url.toString();
};

const fixtureSchema = `
CREATE TABLE users (id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, name text NOT NULL, created_at text NOT NULL);
CREATE TABLE workspaces (id text PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL, created_at text NOT NULL, updated_at text NOT NULL);
CREATE TABLE workspace_members (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES users(id), role text NOT NULL, created_at text NOT NULL, UNIQUE(workspace_id, user_id));
CREATE TABLE repositories (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), user_id text REFERENCES users(id), owner text NOT NULL, name text NOT NULL, full_name text NOT NULL, github_repository_id text NOT NULL, default_branch text NOT NULL, status text NOT NULL, origin text NOT NULL, lifecycle text NOT NULL, created_at text NOT NULL);
CREATE TABLE github_installations (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), installation_id text NOT NULL, account_login text NOT NULL, account_type text NOT NULL, status text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL);
CREATE TABLE github_scan_requests (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), repository_id text NOT NULL REFERENCES repositories(id), commit_sha text NOT NULL, ref text NOT NULL, status text NOT NULL, created_at text NOT NULL);
CREATE TABLE scans (id text PRIMARY KEY, repository_id text NOT NULL REFERENCES repositories(id), sha text NOT NULL, status text NOT NULL, provider text NOT NULL);
CREATE TABLE findings (id text PRIMARY KEY, scan_id text NOT NULL REFERENCES scans(id), repository_id text NOT NULL REFERENCES repositories(id), usage_id text NOT NULL, change_id text NOT NULL, provider text NOT NULL, title text NOT NULL, description text NOT NULL, severity text NOT NULL, confidence double precision NOT NULL, file_path text NOT NULL, line_number integer NOT NULL, symbol text NOT NULL, status text NOT NULL, reason text NOT NULL, reason_codes text NOT NULL, evidence text NOT NULL, created_at text NOT NULL);
CREATE TABLE migrations (id text PRIMARY KEY, finding_id text NOT NULL REFERENCES findings(id), repository_id text NOT NULL REFERENCES repositories(id), plan_id text NOT NULL, status text NOT NULL, plan_json text NOT NULL, created_at text NOT NULL);
CREATE TABLE pull_requests (id text PRIMARY KEY, migration_id text NOT NULL REFERENCES migrations(id), repository_id text NOT NULL REFERENCES repositories(id), number integer NOT NULL, title text NOT NULL, branch_name text NOT NULL, base_branch text NOT NULL, url text NOT NULL, state text NOT NULL, created_at text NOT NULL);
CREATE TABLE workspace_subscriptions (workspace_id text PRIMARY KEY REFERENCES workspaces(id), plan_id text NOT NULL, status text NOT NULL, current_period_start text NOT NULL, current_period_end text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL);
CREATE TABLE workspace_usage (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), metric text NOT NULL, period_start text NOT NULL, period_end text NOT NULL, count integer NOT NULL, created_at text NOT NULL, updated_at text NOT NULL);
CREATE TABLE _apiproof_migrations (id text PRIMARY KEY, name text NOT NULL, applied_at text NOT NULL);
`;

const seed = async (client: PostgresDatabaseAdapter): Promise<void> => {
  await client.query(`
    INSERT INTO users VALUES
      ('u-a', 'a@example.test', 'hash', 'A', now()::text),
      ('u-b', 'b@example.test', 'hash', 'B', now()::text);
    INSERT INTO workspaces VALUES
      ('w-a', 'A', 'workspace-a', now()::text, now()::text),
      ('w-b', 'B', 'workspace-b', now()::text, now()::text);
    INSERT INTO workspace_members VALUES
      ('m-a', 'w-a', 'u-a', 'owner', now()::text),
      ('m-b', 'w-b', 'u-b', 'owner', now()::text);
    INSERT INTO repositories VALUES
      ('r-a', 'w-a', 'u-a', 'owner', 'repo-a', 'owner/repo-a', 'gh-a', 'main', 'connected', 'connected', 'active', now()::text),
      ('r-b', 'w-b', 'u-b', 'owner', 'repo-b', 'owner/repo-b', 'gh-b', 'main', 'connected', 'connected', 'active', now()::text);
  `);
};

suite('PostgreSQL tenant security', () => {
  let admin: PostgresDatabaseAdapter;
  let app: PostgresDatabaseAdapter;
  let migrator: PostgresDatabaseAdapter;

  beforeAll(async () => {
    admin = new PostgresDatabaseAdapter(adminUrl ?? '');
    await admin.query(`DROP SCHEMA IF EXISTS apiproof_security CASCADE`);
    await admin.query(`DROP TABLE IF EXISTS workspace_usage, workspace_subscriptions, pull_requests, migrations, findings, scans, github_scan_requests, github_installations, repositories, workspace_members, workspaces, users, _apiproof_migrations CASCADE`);
    await admin.query(`DROP ROLE IF EXISTS ${appRole}`);
    await admin.query(`DROP ROLE IF EXISTS ${migratorRole}`);
    await admin.query(`CREATE ROLE ${appRole} LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await admin.query(`CREATE ROLE ${migratorRole} LOGIN PASSWORD '${migratorPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await admin.query(fixtureSchema);
    await seed(admin);
    const migrationSql = await readFile(new URL('../docs/postgres-tenant-security-migration.sql', import.meta.url), 'utf8');
    await admin.query(migrationSql);
    await admin.query(`
      GRANT USAGE ON SCHEMA public, apiproof_security TO ${appRole};
      GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces, workspace_members, repositories, github_installations, github_scan_requests, scans, findings, migrations, pull_requests, workspace_subscriptions, workspace_usage TO ${appRole};
      GRANT EXECUTE ON FUNCTION apiproof_security.has_workspace_membership() TO ${appRole};
      GRANT EXECUTE ON FUNCTION apiproof_security.has_repository_access(text) TO ${appRole};
      GRANT SELECT, INSERT ON _apiproof_migrations TO ${migratorRole};
    `);
    app = new PostgresDatabaseAdapter(appConnectionString(adminUrl ?? '', appRole, appPassword));
    migrator = new PostgresDatabaseAdapter(appConnectionString(adminUrl ?? '', migratorRole, migratorPassword));
  });

  afterAll(async () => {
    await app?.close();
    await migrator?.close();
    await admin?.query(`DROP SCHEMA IF EXISTS apiproof_security CASCADE`);
    await admin?.query(`DROP TABLE IF EXISTS workspace_usage, workspace_subscriptions, pull_requests, migrations, findings, scans, github_scan_requests, github_installations, repositories, workspace_members, workspaces, users, _apiproof_migrations CASCADE`);
    await admin?.query(`DROP ROLE IF EXISTS ${appRole}`);
    await admin?.query(`DROP ROLE IF EXISTS ${migratorRole}`);
    await admin?.close();
  });

  it('allows an authorized tenant operation and denies cross-tenant reads', async () => {
    await expect(withPostgresTenantContext(app, 'u-a', 'w-a', async (tx) => tx.query('SELECT id FROM repositories WHERE id = ?', ['r-a']))).resolves.toEqual([{ id: 'r-a' }]);
    await expect(withPostgresTenantContext(app, 'u-a', 'w-a', async (tx) => tx.query('SELECT id FROM repositories WHERE id = ?', ['r-b']))).resolves.toEqual([]);
  });

  it('rejects missing membership before setting a tenant context', async () => {
    await expect(withPostgresTenantContext(app, 'u-a', 'w-b', async () => [])).rejects.toMatchObject({ code: 'TENANT_MEMBERSHIP_REQUIRED' });
    await expect(app.query('SELECT id FROM repositories')).resolves.toEqual([]);
  });

  it('preserves isolation across pooled and concurrent transactions', async () => {
    const results = await Promise.all([
      withPostgresTenantContext(app, 'u-a', 'w-a', async (tx) => tx.query('SELECT id FROM repositories ORDER BY id')),
      withPostgresTenantContext(app, 'u-b', 'w-b', async (tx) => tx.query('SELECT id FROM repositories ORDER BY id')),
    ]);
    expect(results).toEqual([[{ id: 'r-a' }], [{ id: 'r-b' }]]);
    await expect(app.query('SELECT id FROM repositories ORDER BY id')).resolves.toEqual([]);
  });

  it('enforces workspace membership revocation on the next transaction', async () => {
    await admin.query(`DELETE FROM workspace_members WHERE workspace_id = 'w-a' AND user_id = 'u-a'`);
    await expect(withPostgresTenantContext(app, 'u-a', 'w-a', async () => [])).rejects.toMatchObject({ code: 'TENANT_MEMBERSHIP_REQUIRED' });
    await admin.query(`INSERT INTO workspace_members VALUES ('m-a', 'w-a', 'u-a', 'owner', now()::text)`);
  });

  it('keeps application and migrator roles separate', async () => {
    await expect(app.execute('CREATE TABLE app_must_not_create (id text)')).rejects.toBeTruthy();
    await expect(app.execute("INSERT INTO _apiproof_migrations VALUES ('x', 'x', now()::text)")).rejects.toBeTruthy();
    await expect(migrator.query("INSERT INTO _apiproof_migrations VALUES ('ci', 'ci', now()::text)")).resolves.toBeTruthy();
    await expect(migrator.query('SELECT id FROM repositories')).rejects.toBeTruthy();
  });

  it('forces RLS on tenant-owned tables', async () => {
    const rows = await admin.query<{ relname: string; relforcerowsecurity: boolean }>(`SELECT c.relname, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('workspaces', 'workspace_members', 'repositories', 'scans', 'findings', 'migrations', 'pull_requests') ORDER BY c.relname`);
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.relforcerowsecurity)).toBe(true);
  });

  it.todo('prevent arbitrary app-role SET_CONFIG tenant spoofing; a trusted identity bridge is still required beyond custom GUCs');
});
