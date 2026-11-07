import { describe, expect, it } from 'vitest';
import { assertWorkspaceCapability, normalizeWorkspaceRole, workspaceRoleCan } from '../apps/web/src/lib/server/workspace-policy.js';

describe('workspace role capability policy', () => {
  it('accepts only the reviewed role vocabulary and fails closed for unknown values', () => {
    expect(normalizeWorkspaceRole('owner')).toBe('owner');
    expect(normalizeWorkspaceRole('admin')).toBe('admin');
    expect(normalizeWorkspaceRole('member')).toBe('member');
    expect(() => normalizeWorkspaceRole('superuser')).toThrow('WORKSPACE_ROLE_INVALID');
  });

  it('keeps owner capabilities complete and reserves destructive billing/workspace actions', () => {
    expect(workspaceRoleCan('owner', 'workspace:delete')).toBe(true);
    expect(workspaceRoleCan('owner', 'billing:manage')).toBe(true);
    expect(workspaceRoleCan('admin', 'workspace:manage_members')).toBe(true);
    expect(workspaceRoleCan('admin', 'workspace:delete')).toBe(false);
    expect(workspaceRoleCan('admin', 'billing:manage')).toBe(false);
  });

  it('keeps members scoped to ordinary workspace operations', () => {
    expect(workspaceRoleCan('member', 'workspace:read')).toBe(true);
    expect(workspaceRoleCan('member', 'repository:write')).toBe(true);
    expect(workspaceRoleCan('member', 'workspace:manage_members')).toBe(false);
    expect(workspaceRoleCan('member', 'provider_rules:review')).toBe(false);
    expect(() => assertWorkspaceCapability('member', 'workspace:manage_members')).toThrow('WORKSPACE_CAPABILITY_DENIED');
  });
});
