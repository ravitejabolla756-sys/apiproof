import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PostgresDatabaseAdapter } from '../apps/web/src/lib/server/db/postgres-adapter.js';
import { assertWorkerDatabaseAuthorization } from '../apps/web/src/lib/server/db/postgres-worker-authorization.js';

const adminUrl = process.env.TEST_POSTGRES_ADMIN_URL;
const enabled = Boolean(adminUrl);
const suite = enabled ? describe : describe.skip;
const appRole = process.env.TEST_POSTGRES_APP_ROLE ?? 'apiproof_ci_app';
const workerRole = process.env.TEST_POSTGRES_WORKER_ROLE ?? 'apiproof_ci_worker';
const appPassword = process.env.TEST_POSTGRES_APP_PASSWORD ?? 'apiproof-ci-app-password';
const workerPassword = process.env.TEST_POSTGRES_WORKER_PASSWORD ?? 'apiproof-ci-worker-password';
const rolePattern = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function connectionString(base: string, role: string, password: string): string {
  const url = new URL(base);
  url.username = role;
  url.password = password;
  return url.toString();
}

function assertRoleName(role: string): void {
  if (!rolePattern.test(role)) throw new Error('INVALID_TEST_ROLE_NAME');
}

suite('PostgreSQL worker database authorization', () => {
  let admin: PostgresDatabaseAdapter;
  let app: PostgresDatabaseAdapter;
  let worker: PostgresDatabaseAdapter;

  beforeAll(async () => {
    assertRoleName(appRole);
    assertRoleName(workerRole);
    if (appRole === workerRole) throw new Error('TEST_ROLES_MUST_DIFFER');
    admin = new PostgresDatabaseAdapter(adminUrl ?? '');
    await admin.query('DROP SCHEMA IF EXISTS apiproof_security CASCADE');
    await admin.query(`DROP ROLE IF EXISTS ${appRole}`);
    await admin.query(`DROP ROLE IF EXISTS ${workerRole}`);
    await admin.query(`CREATE ROLE ${appRole} LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await admin.query(`CREATE ROLE ${workerRole} LOGIN PASSWORD '${workerPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    await admin.query(`
      CREATE SCHEMA apiproof_security;
      CREATE FUNCTION apiproof_security.has_trusted_worker_identity()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY INVOKER
      SET search_path = pg_catalog
      AS $function$ SELECT current_user = '${workerRole}' $function$;
      REVOKE ALL ON SCHEMA apiproof_security FROM PUBLIC;
      REVOKE ALL ON FUNCTION apiproof_security.has_trusted_worker_identity() FROM PUBLIC;
      GRANT USAGE ON SCHEMA apiproof_security TO ${appRole}, ${workerRole};
      GRANT EXECUTE ON FUNCTION apiproof_security.has_trusted_worker_identity() TO ${appRole}, ${workerRole};
    `);
    app = new PostgresDatabaseAdapter(connectionString(adminUrl ?? '', appRole, appPassword));
    worker = new PostgresDatabaseAdapter(connectionString(adminUrl ?? '', workerRole, workerPassword));
  });

  afterAll(async () => {
    await app?.close();
    await worker?.close();
    await admin?.query(`REVOKE ALL ON SCHEMA apiproof_security FROM ${appRole}, ${workerRole}`);
    await admin?.query(`DROP OWNED BY ${appRole}`);
    await admin?.query(`DROP OWNED BY ${workerRole}`);
    await admin?.query('DROP SCHEMA IF EXISTS apiproof_security CASCADE');
    await admin?.query(`DROP ROLE IF EXISTS ${appRole}`);
    await admin?.query(`DROP ROLE IF EXISTS ${workerRole}`);
    await admin?.close();
  });

  it('denies the ordinary application role and accepts only the worker database role', async () => {
    await expect(assertWorkerDatabaseAuthorization(app)).rejects.toMatchObject({ code: 'WORKER_DATABASE_AUTH_DENIED' });
    await expect(assertWorkerDatabaseAuthorization(worker)).resolves.toBeUndefined();
  });

  it('prevents the application role from impersonating the worker role', async () => {
    await expect(app.query(`SET ROLE ${workerRole}`)).rejects.toBeTruthy();
    await expect(assertWorkerDatabaseAuthorization(app)).rejects.toMatchObject({ code: 'WORKER_DATABASE_AUTH_DENIED' });
  });
});
