/**
 * Read-only migration-history validation for cross-branch preparation.
 *
 * This module deliberately does not execute SQL, mutate the migration ledger,
 * or select a final migration-numbering scheme. It validates the historical
 * facts that an integration migrator must inspect before applying any forward
 * compatibility migration.
 */

export type MigrationBranch = 'member1' | 'member2';

export interface MigrationDefinition {
  readonly id: string;
  readonly name: string;
  readonly branch: MigrationBranch;
  readonly creates: readonly string[];
  readonly requires: readonly string[];
}

export interface AppliedMigration {
  readonly id: string;
  readonly name: string;
}

export interface MigrationHistorySnapshot {
  readonly applied: readonly AppliedMigration[];
  readonly existingObjects: readonly string[];
}

export type MigrationIssueCode =
  | 'DUPLICATE_APPLIED_ID'
  | 'UNKNOWN_MIGRATION'
  | 'MIGRATION_ID_NAME_CONFLICT'
  | 'MIGRATION_OBJECT_MISSING'
  | 'MIXED_HISTORY_REQUIRES_RECONCILIATION';

export interface MigrationHistoryIssue {
  readonly code: MigrationIssueCode;
  readonly id: string;
  readonly message: string;
}

export interface MigrationDefinitionCollision {
  readonly id: string;
  readonly definitions: readonly MigrationDefinition[];
}

export interface MigrationHistoryAssessment {
  readonly state: 'fresh' | 'member1_legacy' | 'member2_legacy' | 'mixed';
  readonly directUpgrade: 'safe' | 'requires_compatibility' | 'blocked';
  readonly issues: readonly MigrationHistoryIssue[];
}

export const MEMBER1_MIGRATION_DEFINITIONS: readonly MigrationDefinition[] = [
  {
    id: '024',
    name: 'email_verification_tokens_and_user_state',
    branch: 'member1',
    creates: ['email_verification_tokens', 'users.email_verified_at'],
    requires: ['users'],
  },
  {
    id: '025',
    name: 'audited_finding_lifecycle',
    branch: 'member1',
    creates: ['findings.lifecycle_state', 'finding_lifecycle_events'],
    requires: ['findings', 'repositories', 'workspaces', 'users'],
  },
  {
    id: '026',
    name: 'finding_resolution_verification_evidence',
    branch: 'member1',
    creates: ['pull_requests.merge_sha', 'finding_resolution_verifications'],
    requires: ['pull_requests', 'migrations', 'findings', 'scans', 'repositories', 'workspaces'],
  },
  {
    id: '027',
    name: 'durable_workspace_member_revocation',
    branch: 'member1',
    creates: ['workspace_member_revocation_requests', 'workspace_security_audit_events'],
    requires: ['workspaces'],
  },
];

export const MEMBER2_MIGRATION_DEFINITIONS: readonly MigrationDefinition[] = [
  {
    id: '024',
    name: 'workspace_invitations_and_audit_events',
    branch: 'member2',
    creates: ['workspace_invitations', 'workspace_audit_events'],
    requires: ['workspaces', 'users'],
  },
  {
    id: '025',
    name: 'user_notification_preferences',
    branch: 'member2',
    creates: ['user_notification_preferences'],
    requires: ['users'],
  },
  {
    id: '026',
    name: 'email_delivery_ledger',
    branch: 'member2',
    creates: ['email_deliveries'],
    requires: ['users', 'workspaces'],
  },
  {
    id: '027',
    name: 'slack_scan_failure_deliveries',
    branch: 'member2',
    creates: ['slack_scan_failure_deliveries'],
    requires: ['workspaces', 'repositories', 'github_scan_requests', 'slack_connections'],
  },
];

export const ALL_MEMBER_MIGRATION_DEFINITIONS: readonly MigrationDefinition[] = [
  ...MEMBER1_MIGRATION_DEFINITIONS,
  ...MEMBER2_MIGRATION_DEFINITIONS,
];

function definitionsById(definitions: readonly MigrationDefinition[]): Map<string, MigrationDefinition[]> {
  const grouped = new Map<string, MigrationDefinition[]>();
  for (const definition of definitions) {
    const values = grouped.get(definition.id) ?? [];
    values.push(definition);
    grouped.set(definition.id, values);
  }
  return grouped;
}

export function findMigrationDefinitionCollisions(
  definitions: readonly MigrationDefinition[] = ALL_MEMBER_MIGRATION_DEFINITIONS,
): readonly MigrationDefinitionCollision[] {
  return [...definitionsById(definitions).entries()]
    .filter(([, values]) => new Set(values.map((value) => value.name)).size > 1)
    .map(([id, values]) => ({ id, definitions: values }));
}

function knownDefinitionsById(definitions: readonly MigrationDefinition[]): Map<string, MigrationDefinition[]> {
  return definitionsById(definitions);
}

function classifyState(applied: readonly AppliedMigration[], definitions: readonly MigrationDefinition[]): MigrationHistoryAssessment['state'] {
  const known = new Map(applied.map((row) => [row.id, row.name]));
  const branches = new Set<MigrationBranch>();
  for (const definition of definitions) {
    if (known.get(definition.id) === definition.name) branches.add(definition.branch);
  }
  if (branches.size === 0) return 'fresh';
  if (branches.size > 1) return 'mixed';
  return branches.has('member1') ? 'member1_legacy' : 'member2_legacy';
}

export function assessMigrationHistory(
  snapshot: MigrationHistorySnapshot,
  definitions: readonly MigrationDefinition[] = ALL_MEMBER_MIGRATION_DEFINITIONS,
): MigrationHistoryAssessment {
  const issues: MigrationHistoryIssue[] = [];
  const byId = knownDefinitionsById(definitions);
  const seenIds = new Set<string>();
  const objectSet = new Set(snapshot.existingObjects);

  for (const applied of snapshot.applied) {
    if (seenIds.has(applied.id)) {
      issues.push({ code: 'DUPLICATE_APPLIED_ID', id: applied.id, message: `Migration ledger contains duplicate id ${applied.id}.` });
      continue;
    }
    seenIds.add(applied.id);
    const candidates = byId.get(applied.id);
    if (!candidates) {
      issues.push({ code: 'UNKNOWN_MIGRATION', id: applied.id, message: `Migration ${applied.id} is not present in the reviewed definitions.` });
      continue;
    }
    const matching = candidates.filter((candidate) => candidate.name === applied.name);
    if (matching.length === 0) {
      issues.push({ code: 'MIGRATION_ID_NAME_CONFLICT', id: applied.id, message: `Migration ${applied.id} is recorded as ${applied.name}, but the reviewed definitions use a different name.` });
      continue;
    }
    for (const objectName of matching[0]!.creates) {
      if (!objectSet.has(objectName)) {
        issues.push({ code: 'MIGRATION_OBJECT_MISSING', id: applied.id, message: `Migration ${applied.id} records ${matching[0]!.name}, but required object ${objectName} is absent.` });
      }
    }
  }

  const state = classifyState(snapshot.applied, definitions);
  if (state === 'mixed') {
    issues.push({ code: 'MIXED_HISTORY_REQUIRES_RECONCILIATION', id: '024-027', message: 'Migration history contains both Member 1 and Member 2 identities; direct replay is not safe.' });
  }

  const hasBlockingIssue = issues.some((issue) => issue.code !== 'MIXED_HISTORY_REQUIRES_RECONCILIATION');
  return {
    state,
    directUpgrade: hasBlockingIssue || state === 'mixed' ? 'blocked' : 'requires_compatibility',
    issues,
  };
}

export function assertMigrationHistorySafe(snapshot: MigrationHistorySnapshot): void {
  const assessment = assessMigrationHistory(snapshot);
  if (assessment.issues.length > 0) {
    throw new Error(`MIGRATION_HISTORY_REQUIRES_REVIEW:${assessment.issues.map((issue) => issue.code).join(',')}`);
  }
}
