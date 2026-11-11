import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dbDir = path.resolve('apps/web/src/lib/server/db');
const rlsMigrationFiles = [
  'email-verification-migration.ts',
  'google-oauth-migration.ts',
  'github-login-migration.ts',
  'member-revocation-migration.ts',
];

describe('SEC-01 PostgreSQL RLS static inventory', () => {
  it('requires each PostgreSQL RLS migration to enable RLS and revoke default table access', () => {
    for (const fileName of rlsMigrationFiles) {
      const source = fs.readFileSync(path.join(dbDir, fileName), 'utf8');
      expect(source, fileName).toMatch(/ENABLE ROW LEVEL SECURITY/);
      expect(source, fileName).toMatch(/REVOKE ALL ON TABLE/);
    }
  });

  it('keeps the missing policy-definition evidence explicit instead of claiming acceptance', () => {
    const source = rlsMigrationFiles
      .map((fileName) => fs.readFileSync(path.join(dbDir, fileName), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/CREATE POLICY/);
    expect(source).not.toMatch(/FORCE ROW LEVEL SECURITY/);
  });
});
