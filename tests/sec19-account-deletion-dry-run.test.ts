import { describe, expect, it } from 'vitest';
import { buildAccountDeletionDryRunPlan, type AccountDeletionPolicyApproval, type AccountDeletionSecurityContext } from '@/lib/server/account-deletion-plan';

const security: AccountDeletionSecurityContext = {
  actorUserId: 'user-1', subjectUserId: 'user-1', reauthenticated: true, csrfValidated: true, idempotencyKey: 'delete:user-1:request-1',
};
const workspaces = [{ workspaceId: 'workspace-1', role: 'owner', ownerCount: 2 }];
const approval: AccountDeletionPolicyApproval = {
  approved: true, policyVersion: 'retention-v1', legalPolicyReference: 'OWNER-DECISION-SEC19',
  dispositions: { user_profile: 'delete', sessions: 'delete', password_reset_tokens: 'delete', workspace_memberships: 'owner_review', repositories_and_scans: 'owner_review', findings_and_migrations: 'retain', activity_events: 'anonymize', github_connections: 'owner_review', billing_customer_and_subscription: 'owner_review', billing_webhook_events: 'retain', audit_and_security_events: 'retain', backups_and_exports: 'owner_review' },
};

describe('SEC-19 account deletion dry-run boundary', () => {
  it('fails closed without legal retention approval', () => {
    const result = buildAccountDeletionDryRunPlan({ security, workspaces });
    expect(result).toEqual({ ok: false, blockers: ['RETENTION_POLICY_NOT_APPROVED'] });
  });

  it('requires same-user authorization, reauthentication, CSRF and idempotency', () => {
    const result = buildAccountDeletionDryRunPlan({
      security: { ...security, actorUserId: 'other-user', reauthenticated: false, csrfValidated: false, idempotencyKey: '' }, workspaces, approval,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blockers).toEqual(expect.arrayContaining(['UNAUTHORIZED_ACTOR', 'REAUTHENTICATION_REQUIRED', 'CSRF_VALIDATION_REQUIRED', 'IDEMPOTENCY_KEY_REQUIRED']));
  });

  it('protects a sole workspace owner unless transfer or closure is approved', () => {
    const result = buildAccountDeletionDryRunPlan({ security, workspaces: [{ workspaceId: 'workspace-1', role: 'owner', ownerCount: 1 }], approval });
    expect(result).toEqual({ ok: false, blockers: ['FINAL_OWNER_PROTECTED'] });
  });

  it('produces a deterministic, non-destructive plan for approved synthetic data', () => {
    const first = buildAccountDeletionDryRunPlan({ security, workspaces, approval });
    const second = buildAccountDeletionDryRunPlan({ security, workspaces, approval });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, plan: { destructiveExecutionEnabled: false, status: 'ready_for_owner_review' } });
    if (first.ok) expect(first.plan.steps.map((step) => step.area)).toContain('github_connections');
  });

  it('allows an explicitly approved final-owner action without executing it', () => {
    const result = buildAccountDeletionDryRunPlan({ security, workspaces: [{ workspaceId: 'workspace-1', role: 'owner', ownerCount: 1, finalOwnerAction: 'transfer' }], approval });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.destructiveExecutionEnabled).toBe(false);
  });
});
