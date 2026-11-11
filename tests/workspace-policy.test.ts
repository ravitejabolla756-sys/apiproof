import { describe, expect, it } from 'vitest';
import {
  assertWorkspaceCapability,
  normalizeWorkspaceRole,
  WORKSPACE_CAPABILITIES,
  workspaceRoleCan,
  type WorkspaceCapability,
  type WorkspaceRole,
} from '../apps/web/src/lib/server/workspace-policy.js';

describe('workspace role capability policy', () => {
  it('accepts only the reviewed role vocabulary and fails closed for unknown values', () => {
    expect(normalizeWorkspaceRole('owner')).toBe('owner');
    expect(normalizeWorkspaceRole('admin')).toBe('admin');
    expect(normalizeWorkspaceRole('member')).toBe('member');
    expect(() => normalizeWorkspaceRole('viewer')).toThrow('WORKSPACE_ROLE_INVALID');
    expect(workspaceRoleCan('viewer', 'workspace:read')).toBe(false);
    expect(() => normalizeWorkspaceRole('superuser')).toThrow('WORKSPACE_ROLE_INVALID');
    expect(workspaceRoleCan('superuser', 'workspace:read')).toBe(false);
    expect(() => assertWorkspaceCapability('superuser', 'workspace:read')).toThrow('WORKSPACE_CAPABILITY_DENIED');
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

  it('keeps the complete owner, admin, and member capability matrix stable', () => {
    const allowed: Record<WorkspaceRole, ReadonlySet<WorkspaceCapability>> = {
      owner: new Set(WORKSPACE_CAPABILITIES),
      admin: new Set([
        'workspace:read',
        'workspace:manage_members',
        'workspace:manage_settings',
        'repository:read',
        'repository:write',
        'integration:manage',
        'provider_rules:review',
        'audit:read',
      ]),
      member: new Set([
        'workspace:read',
        'repository:read',
        'repository:write',
        'integration:manage',
        'audit:read',
      ]),
    };

    for (const role of Object.keys(allowed) as WorkspaceRole[]) {
      for (const capability of WORKSPACE_CAPABILITIES) {
        expect(workspaceRoleCan(role, capability), `${role} should ${allowed[role].has(capability) ? '' : 'not '}have ${capability}`)
          .toBe(allowed[role].has(capability));
      }
    }
  });
});
