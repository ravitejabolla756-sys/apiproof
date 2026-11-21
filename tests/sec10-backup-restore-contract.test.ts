import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rehearsalPath = path.resolve('docs/sec-10-backup-restore-rehearsal.md');

describe('SEC-10 backup and restore rehearsal contract', () => {
  it('documents non-production isolation, ledger, security, measurement, and rollback gates', () => {
    const source = fs.readFileSync(rehearsalPath, 'utf8');
    for (const requiredText of [
      'SEC-10 remains `BLOCKED_EXTERNAL`',
      'migration-ledger provenance',
      'object-storage isolation controls',
      'role grants',
      'RLS flags/policies',
      'cross-tenant read/write negatives',
      'actual measurements',
      'manual rollback authority',
      'Do not rename, replay, or repair migration IDs 024–027',
    ]) {
      expect(source).toContain(requiredText);
    }
  });

  it('contains no credentials, connection strings, or live restore commands', () => {
    const source = fs.readFileSync(rehearsalPath, 'utf8');
    expect(source).not.toMatch(/(?:postgres(?:ql)?:\/\/|DATABASE_URL|password\s*=|secret\s*=|BEGIN [A-Z ]+ KEY)/i);
    expect(source).not.toMatch(/^\s*(pg_restore|psql|aws\s+s3\s+cp|supabase\s+db\s+restore)\b/im);
    expect(source).toContain('No credentials, URLs, customer rows, backup contents or key material');
  });
});
