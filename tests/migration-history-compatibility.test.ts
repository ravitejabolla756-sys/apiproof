import { describe, expect, it } from 'vitest';
import {
  ALL_MEMBER_MIGRATION_DEFINITIONS,
  MEMBER1_MIGRATION_DEFINITIONS,
  MEMBER2_MIGRATION_DEFINITIONS,
  assessMigrationHistory,
  assertMigrationHistorySafe,
  findMigrationDefinitionCollisions,
} from '../apps/web/src/lib/server/db/migration-history-compatibility.js';

const member1Objects = MEMBER1_MIGRATION_DEFINITIONS.flatMap((migration) => migration.creates);
const member2Objects = MEMBER2_MIGRATION_DEFINITIONS.flatMap((migration) => migration.creates);
const rows = (definitions: typeof MEMBER1_MIGRATION_DEFINITIONS) => definitions.map(({ id, name }) => ({ id, name }));

describe('migration history compatibility preparation', () => {
  it('detects every 024-027 ID/name collision without selecting new numbers', () => {
    const collisions = findMigrationDefinitionCollisions();
    expect(collisions.map((collision) => collision.id)).toEqual(['024', '025', '026', '027']);
    expect(collisions.every((collision) => collision.definitions.length === 2)).toBe(true);
  });

  it('treats a fresh database as requiring an approved compatibility plan', () => {
    const assessment = assessMigrationHistory({ applied: [], existingObjects: [] });
    expect(assessment.state).toBe('fresh');
    expect(assessment.directUpgrade).toBe('requires_compatibility');
    expect(assessment.issues).toHaveLength(0);
  });

  it('recognizes a complete Member 1 legacy ledger without silently accepting it as integrated', () => {
    const assessment = assessMigrationHistory({ applied: rows(MEMBER1_MIGRATION_DEFINITIONS), existingObjects: member1Objects });
    expect(assessment.state).toBe('member1_legacy');
    expect(assessment.directUpgrade).toBe('requires_compatibility');
    expect(assessment.issues).toHaveLength(0);
  });

  it('recognizes a complete Member 2 legacy ledger without treating IDs as Member 1 migrations', () => {
    const assessment = assessMigrationHistory({ applied: rows(MEMBER2_MIGRATION_DEFINITIONS), existingObjects: member2Objects });
    expect(assessment.state).toBe('member2_legacy');
    expect(assessment.directUpgrade).toBe('requires_compatibility');
    expect(assessment.issues).toHaveLength(0);
  });

  it('fails closed for mixed histories and conflicting ID/name rows', () => {
    const mixed = assessMigrationHistory({
      applied: [rows(MEMBER1_MIGRATION_DEFINITIONS)[0]!, rows(MEMBER2_MIGRATION_DEFINITIONS)[1]!],
      existingObjects: [...member1Objects, ...member2Objects],
    });
    expect(mixed.state).toBe('mixed');
    expect(mixed.directUpgrade).toBe('blocked');
    expect(mixed.issues.map((issue) => issue.code)).toContain('MIXED_HISTORY_REQUIRES_RECONCILIATION');

    const conflict = assessMigrationHistory({
      applied: [{ id: '024', name: 'unreviewed_name' }],
      existingObjects: [],
    });
    expect(conflict.directUpgrade).toBe('blocked');
    expect(conflict.issues[0]?.code).toBe('MIGRATION_ID_NAME_CONFLICT');
    expect(() => assertMigrationHistorySafe({ applied: [{ id: '024', name: 'unreviewed_name' }], existingObjects: [] })).toThrow('MIGRATION_HISTORY_REQUIRES_REVIEW');
  });

  it('fails closed for an unrecognized migration ID', () => {
    const assessment = assessMigrationHistory({
      applied: [{ id: '999', name: 'unreviewed_migration' }],
      existingObjects: [],
    });
    expect(assessment.directUpgrade).toBe('blocked');
    expect(assessment.issues.map((issue) => issue.code)).toContain('UNKNOWN_MIGRATION');
    expect(() => assertMigrationHistorySafe({
      applied: [{ id: '999', name: 'unreviewed_migration' }],
      existingObjects: [],
    })).toThrow('MIGRATION_HISTORY_REQUIRES_REVIEW');
  });

  it('fails closed for duplicate applied IDs', () => {
    const assessment = assessMigrationHistory({
      applied: [
        { id: '024', name: 'email_verification_tokens_and_user_state' },
        { id: '024', name: 'email_verification_tokens_and_user_state' },
      ],
      existingObjects: member1Objects,
    });
    expect(assessment.directUpgrade).toBe('blocked');
    expect(assessment.issues.map((issue) => issue.code)).toContain('DUPLICATE_APPLIED_ID');
  });

  it('is deterministic and non-mutating when assessed repeatedly', () => {
    const snapshot = { applied: rows(MEMBER1_MIGRATION_DEFINITIONS), existingObjects: member1Objects };
    const first = assessMigrationHistory(snapshot);
    const second = assessMigrationHistory(snapshot);
    expect(second).toEqual(first);
    expect(snapshot.applied).toEqual(rows(MEMBER1_MIGRATION_DEFINITIONS));
  });

  it('detects a ledger row whose recorded schema is incomplete', () => {
    const assessment = assessMigrationHistory({
      applied: rows(MEMBER1_MIGRATION_DEFINITIONS),
      existingObjects: member1Objects.filter((objectName) => objectName !== 'workspace_security_audit_events'),
    }, ALL_MEMBER_MIGRATION_DEFINITIONS);
    expect(assessment.directUpgrade).toBe('blocked');
    expect(assessment.issues.map((issue) => issue.code)).toContain('MIGRATION_OBJECT_MISSING');
  });
});
