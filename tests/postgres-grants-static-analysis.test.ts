import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const templatePath = path.resolve('docs/sec-02-postgres-grants.sql');

describe('SEC-02 PostgreSQL grants evidence template', () => {
  it('is metadata-only and contains no credentials or connection strings', () => {
    const source = fs.readFileSync(templatePath, 'utf8');
    expect(source).toMatch(/current_user/);
    expect(source).toMatch(/information_schema\.role_table_grants/);
    expect(source).toMatch(/pg_auth_members/);
    expect(source).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/im);
    expect(source).not.toMatch(/(?:postgres(?:ql)?:\/\/|DATABASE_URL|password\s*=|secret\s*=|BEGIN [A-Z ]+ KEY)/i);
  });

  it('checks the privilege boundaries required for application and migrator review', () => {
    const source = fs.readFileSync(templatePath, 'utf8');
    for (const requiredExpression of [
      'rolsuper',
      'rolcreaterole',
      'rolcreatedb',
      'rolbypassrls',
      "has_schema_privilege(current_user, 'public', 'CREATE')",
      "has_table_privilege(current_user, '_apiproof_migrations', 'INSERT')",
      'pg_policies',
    ]) {
      expect(source).toContain(requiredExpression);
    }
  });
});
