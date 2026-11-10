export type WorkspaceRole = 'owner' | 'admin' | 'member';

export const WORKSPACE_CAPABILITIES = [
  'workspace:read',
  'workspace:manage_members',
  'workspace:manage_settings',
  'workspace:delete',
  'repository:read',
  'repository:write',
  'integration:manage',
  'provider_rules:review',
  'billing:manage',
  'audit:read',
] as const;

export type WorkspaceCapability = typeof WORKSPACE_CAPABILITIES[number];

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === 'owner' || value === 'admin' || value === 'member';
}

const ROLE_CAPABILITIES: Readonly<Record<WorkspaceRole, ReadonlySet<WorkspaceCapability>>> = {
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
  member: new Set(['workspace:read', 'repository:read', 'repository:write', 'integration:manage', 'audit:read']),
};

export function normalizeWorkspaceRole(value: string): WorkspaceRole {
  if (isWorkspaceRole(value)) return value;
  throw new Error('WORKSPACE_ROLE_INVALID');
}

export function workspaceRoleCan(role: WorkspaceRole | string, capability: WorkspaceCapability): boolean {
  return ROLE_CAPABILITIES[role as WorkspaceRole]?.has(capability) ?? false;
}

export function assertWorkspaceCapability(role: WorkspaceRole | string, capability: WorkspaceCapability): void {
  if (!workspaceRoleCan(role, capability)) throw new Error('WORKSPACE_CAPABILITY_DENIED');
}
