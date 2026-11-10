import type { MigrationRecord } from './types.js';

export type MigrationHistoryScenario =
  | 'fresh'
  | 'member1-legacy'
  | 'member2-legacy'
  | 'mixed'
  | 'conflicting-id';

export interface MigrationIdentity {
  id: string;
  name: string;
}

export interface MigrationCompatibilityInput {
  available: readonly MigrationIdentity[];
  applied: readonly MigrationRecord[];
  schema?: SchemaEvidence;
}

export interface SchemaEvidence {
  engine: 'sqlite' | 'postgres';
  expectedObjects: readonly string[];
  observedObjects: readonly string[];
}

export interface MigrationCompatibilityResult {
  compatible: boolean;
  pending: MigrationIdentity[];
  errors: string[];
}

/**
 * Validates migration identity before any migration DDL is executed.
 *
 * The existing migrator treats an id as sufficient identity. This boundary
 * additionally requires the recorded name to match, rejects duplicate or
 * unknown records, and returns a deterministic plan for the caller to gate.
 */
export function validateMigrationHistory(input: MigrationCompatibilityInput): MigrationCompatibilityResult {
  const errors: string[] = [];
  const availableById = new Map<string, MigrationIdentity>();
  const appliedById = new Map<string, MigrationRecord>();

  for (const migration of input.available) {
    if (availableById.has(migration.id)) {
      errors.push(`DUPLICATE_AVAILABLE_ID:${migration.id}`);
      continue;
    }
    availableById.set(migration.id, migration);
  }

  for (const record of input.applied) {
    if (appliedById.has(record.id)) {
      errors.push(`DUPLICATE_APPLIED_ID:${record.id}`);
      continue;
    }
    appliedById.set(record.id, record);

    const expected = availableById.get(record.id);
    if (!expected) {
      errors.push(`UNKNOWN_APPLIED_ID:${record.id}`);
    } else if (expected.name !== record.name) {
      errors.push(`MIGRATION_ID_NAME_CONFLICT:${record.id}:${record.name}:${expected.name}`);
    }
    if (!record.appliedAt) errors.push(`INCOMPLETE_APPLIED_RECORD:${record.id}:appliedAt`);
    if (!record.name) errors.push(`INCOMPLETE_APPLIED_RECORD:${record.id}:name`);
  }

  if (input.schema) {
    const expected = new Set(input.schema.expectedObjects);
    const observed = new Set(input.schema.observedObjects);
    for (const object of expected) {
      if (!observed.has(object)) errors.push(`MISSING_SCHEMA_OBJECT:${input.schema.engine}:${object}`);
    }
    for (const object of observed) {
      if (!expected.has(object)) errors.push(`UNEXPECTED_SCHEMA_OBJECT:${input.schema.engine}:${object}`);
    }
  }

  const pending = input.available.filter((migration) => !appliedById.has(migration.id));
  return { compatible: errors.length === 0, pending, errors };
}
