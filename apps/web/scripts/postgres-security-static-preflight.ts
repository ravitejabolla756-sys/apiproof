import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const rlsMigrationFiles = [
  'email-verification-migration.ts',
  'google-oauth-migration.ts',
  'github-login-migration.ts',
  'member-revocation-migration.ts',
];

export interface PostgresSecurityStaticReport {
  status: 'ready_for_approved_postgres' | 'blocked';
  checks: string[];
  blockers: string[];
  evidenceBoundary: 'static_only';
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

/**
 * Checks only repository artifacts. It never opens a database or changes a
 * migration. A ready result means an approved PostgreSQL run can begin; it
 * does not prove effective RLS, grants, role separation, or tenant isolation.
 */
export function buildPostgresSecurityStaticReport(): PostgresSecurityStaticReport {
  const checks: string[] = [];
  const blockers: string[] = [];
  const rlsSource = rlsMigrationFiles.map((fileName) => ({ fileName, source: read(`apps/web/src/lib/server/db/${fileName}`) }));
  for (const { fileName, source } of rlsSource) {
    if (!/ENABLE ROW LEVEL SECURITY/i.test(source)) blockers.push(`${fileName}:RLS_ENABLE_MISSING`);
    if (!/REVOKE ALL ON TABLE/i.test(source)) blockers.push(`${fileName}:DEFAULT_TABLE_ACCESS_REVOKE_MISSING`);
  }
  if (!blockers.length) checks.push(`RLS migration inventory: ${rlsMigrationFiles.length} files contain enable/revoke guards.`);

  const grants = read('docs/sec-02-postgres-grants.sql');
  for (const expression of [
    'current_user',
    'current_setting(\'server_version\')',
    'pg_roles',
    'pg_auth_members',
    'information_schema.role_table_grants',
    'pg_policies',
    "has_schema_privilege(current_user, 'public', 'CREATE')",
  ]) {
    if (!grants.includes(expression)) blockers.push(`sec-02-postgres-grants.sql:REQUIRED_EVIDENCE_MISSING:${expression}`);
  }
  if (/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/im.test(grants)) {
    blockers.push('sec-02-postgres-grants.sql:NON_METADATA_OPERATION_PRESENT');
  } else {
    checks.push('SEC-02 grant evidence template contains metadata queries only.');
  }

  return {
    status: blockers.length ? 'blocked' : 'ready_for_approved_postgres',
    checks,
    blockers,
    evidenceBoundary: 'static_only',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const report = buildPostgresSecurityStaticReport();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'ready_for_approved_postgres' ? 0 : 1;
}
