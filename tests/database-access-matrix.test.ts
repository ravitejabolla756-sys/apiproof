import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const databaseSourceDirectory = path.resolve(process.cwd(), 'apps/web/src/lib/server/db');
const accessMatrixPath = path.resolve(process.cwd(), 'docs/v1-member1-db-access-matrix.md');
const EXPECTED_POSTGRES_RESTRICTED_TABLES = [
  'email_verification_tokens',
  'finding_lifecycle_events',
  'finding_resolution_verifications',
  'github_login_oauth_states',
  'github_oauth_accounts',
  'google_oauth_accounts',
  'google_oauth_states',
  'worker_run_heartbeats',
  'workspace_member_revocation_requests',
  'workspace_security_audit_events',
];

function sourceTableNames(): Set<string> {
  const names = new Set<string>();
  for (const fileName of fs.readdirSync(databaseSourceDirectory).filter((name) => name.endsWith('.ts'))) {
    const source = fs.readFileSync(path.join(databaseSourceDirectory, fileName), 'utf8');
    for (const match of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_][a-z0-9_]*)/gi)) {
      names.add(match[1]!.toLowerCase());
    }
  }
  return names;
}

function documentedTableNames(): string[] {
  const lines = fs.readFileSync(accessMatrixPath, 'utf8').split(/\r?\n/);
  const names: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## Current role and grant matrix')) break;
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (match) names.push(match[1]!.toLowerCase());
  }
  return names;
}

function databaseSource(): string {
  return fs.readdirSync(databaseSourceDirectory)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => fs.readFileSync(path.join(databaseSourceDirectory, name), 'utf8'))
    .join('\n');
}

function documentedPostgresRestrictedTables(): string[] {
  const lines = fs.readFileSync(accessMatrixPath, 'utf8').split(/\r?\n/);
  const names: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## Current role and grant matrix')) break;
    const cells = line.split('|').map((cell) => cell.trim());
    const table = cells[1]?.match(/^`([^`]+)`$/)?.[1];
    const securityNotes = cells.at(-2) ?? '';
    if (table && /enables RLS and revokes `PUBLIC`, `anon`, `authenticated`/i.test(securityNotes)) {
      names.push(table.toLowerCase());
    }
  }
  return names;
}

function postgresRlsEnabledTables(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/ALTER\s+TABLE\s+["`]?([a-z_][a-z0-9_]*)["`]?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)) {
    names.add(match[1]!.toLowerCase());
  }
  return names;
}

function postgresRevokedTables(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/REVOKE\s+ALL\s+ON\s+TABLE\s+([a-z_][a-z0-9_]*(?:\s*,\s*[a-z_][a-z0-9_]*)*)\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/gi)) {
    for (const table of match[1]!.split(',')) names.add(table.trim().toLowerCase());
  }
  return names;
}

describe('database access matrix source inventory', () => {
  it('documents every table defined by the database schema and migrations exactly once', () => {
    const source = sourceTableNames();
    const documented = documentedTableNames();

    expect(documented.sort()).toEqual([...source].sort());
  });

  it('keeps documented PostgreSQL RLS and direct-client revoke claims aligned with migrations', () => {
    const source = databaseSource();
    const expected = documentedPostgresRestrictedTables();
    const rlsEnabled = postgresRlsEnabledTables(source);
    const revoked = postgresRevokedTables(source);

    expect(expected.sort()).toEqual([...EXPECTED_POSTGRES_RESTRICTED_TABLES].sort());
    expect(new Set(expected).size).toBe(expected.length);
    for (const table of expected) {
      expect(rlsEnabled.has(table), `${table} must enable row-level security`).toBe(true);
      expect(revoked.has(table), `${table} must revoke PUBLIC, anon, and authenticated`).toBe(true);
    }
  });

  it('keeps the read-only catalog pack coverage for role inheritance and schema/database access', () => {
    const matrix = fs.readFileSync(accessMatrixPath, 'utf8');

    expect(matrix).toContain('FROM pg_auth_members membership');
    expect(matrix).toContain("pg_has_role(member.oid, granted.oid, 'MEMBER')");
    expect(matrix).toContain("pg_has_role(member.oid, granted.oid, 'USAGE')");
    expect(matrix).toContain("has_schema_privilege(gr.oid, ns.oid, 'USAGE')");
    expect(matrix).toContain("has_schema_privilege(gr.oid, ns.oid, 'CREATE')");
    expect(matrix).toContain('has_database_privilege(gr.oid, db.oid,');
    expect(matrix).toContain('db.datacl');
  });
});
