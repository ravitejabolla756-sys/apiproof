export type DeletionDisposition = 'delete' | 'anonymize' | 'retain' | 'export_then_delete' | 'owner_review';

export type AccountDeletionBlocker =
  | 'UNAUTHORIZED_ACTOR'
  | 'REAUTHENTICATION_REQUIRED'
  | 'CSRF_VALIDATION_REQUIRED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'RETENTION_POLICY_NOT_APPROVED'
  | 'FINAL_OWNER_PROTECTED'
  | 'WORKSPACE_SCOPE_REQUIRED';

export interface AccountDeletionSecurityContext {
  actorUserId: string;
  subjectUserId: string;
  reauthenticated: boolean;
  csrfValidated: boolean;
  idempotencyKey: string;
}

export interface AccountDeletionWorkspaceMembership {
  workspaceId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | string;
  ownerCount: number;
  finalOwnerAction?: 'transfer' | 'close_workspace';
}

export interface AccountDeletionPolicyApproval {
  approved: boolean;
  policyVersion: string;
  legalPolicyReference: string;
  dispositions: Partial<Record<AccountDeletionDataArea, DeletionDisposition>>;
}

export type AccountDeletionDataArea =
  | 'user_profile'
  | 'sessions'
  | 'password_reset_tokens'
  | 'workspace_memberships'
  | 'repositories_and_scans'
  | 'findings_and_migrations'
  | 'activity_events'
  | 'github_connections'
  | 'billing_customer_and_subscription'
  | 'billing_webhook_events'
  | 'audit_and_security_events'
  | 'backups_and_exports';

export interface AccountDeletionPlanStep {
  area: AccountDeletionDataArea;
  disposition: DeletionDisposition;
  authorizationScope: 'user' | 'workspace' | 'provider' | 'owner_review';
  requiresExternalAction: boolean;
}

export interface AccountDeletionPlan {
  kind: 'account-deletion-dry-run';
  status: 'ready_for_owner_review';
  subjectUserId: string;
  idempotencyKey: string;
  policyVersion: string;
  legalPolicyReference: string;
  steps: AccountDeletionPlanStep[];
  destructiveExecutionEnabled: false;
}

export type AccountDeletionPlanResult =
  | { ok: true; plan: AccountDeletionPlan }
  | { ok: false; blockers: AccountDeletionBlocker[] };

const REQUIRED_AREAS: ReadonlyArray<{ area: AccountDeletionDataArea; scope: AccountDeletionPlanStep['authorizationScope']; external: boolean }> = [
  { area: 'user_profile', scope: 'user', external: false },
  { area: 'sessions', scope: 'user', external: false },
  { area: 'password_reset_tokens', scope: 'user', external: false },
  { area: 'workspace_memberships', scope: 'workspace', external: false },
  { area: 'repositories_and_scans', scope: 'workspace', external: false },
  { area: 'findings_and_migrations', scope: 'workspace', external: false },
  { area: 'activity_events', scope: 'workspace', external: false },
  { area: 'github_connections', scope: 'provider', external: true },
  { area: 'billing_customer_and_subscription', scope: 'provider', external: true },
  { area: 'billing_webhook_events', scope: 'workspace', external: false },
  { area: 'audit_and_security_events', scope: 'owner_review', external: false },
  { area: 'backups_and_exports', scope: 'owner_review', external: true },
];

function validId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

export function buildAccountDeletionDryRunPlan(input: {
  security: AccountDeletionSecurityContext;
  workspaces: readonly AccountDeletionWorkspaceMembership[];
  approval?: AccountDeletionPolicyApproval;
}): AccountDeletionPlanResult {
  const blockers: AccountDeletionBlocker[] = [];
  const { security } = input;

  if (!validId(security.actorUserId) || security.actorUserId !== security.subjectUserId) blockers.push('UNAUTHORIZED_ACTOR');
  if (!security.reauthenticated) blockers.push('REAUTHENTICATION_REQUIRED');
  if (!security.csrfValidated) blockers.push('CSRF_VALIDATION_REQUIRED');
  if (!validId(security.idempotencyKey)) blockers.push('IDEMPOTENCY_KEY_REQUIRED');
  if (!input.workspaces.length) blockers.push('WORKSPACE_SCOPE_REQUIRED');
  if (!input.approval?.approved || !input.approval.policyVersion || !input.approval.legalPolicyReference) blockers.push('RETENTION_POLICY_NOT_APPROVED');

  for (const membership of input.workspaces) {
    if (membership.role === 'owner' && membership.ownerCount <= 1 && !membership.finalOwnerAction) blockers.push('FINAL_OWNER_PROTECTED');
  }

  if (blockers.length) return { ok: false, blockers: [...new Set(blockers)] };

  const approval = input.approval!;
  const steps = REQUIRED_AREAS.map(({ area, scope, external }) => ({
    area,
    disposition: approval.dispositions[area] ?? 'owner_review',
    authorizationScope: scope,
    requiresExternalAction: external,
  }));

  return {
    ok: true,
    plan: {
      kind: 'account-deletion-dry-run',
      status: 'ready_for_owner_review',
      subjectUserId: security.subjectUserId,
      idempotencyKey: security.idempotencyKey,
      policyVersion: approval.policyVersion,
      legalPolicyReference: approval.legalPolicyReference,
      steps,
      destructiveExecutionEnabled: false,
    },
  };
}
