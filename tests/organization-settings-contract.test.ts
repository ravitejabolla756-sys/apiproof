import { describe, expect, it } from 'vitest';
import { parseWorkspaceSettings } from '../apps/web/src/lib/organization-settings-contract.js';

const workspace = { id: 'ws-primary', name: 'Primary Workspace', slug: 'primary-workspace', role: 'owner' } as const;

describe('workspace settings response contract', () => {
  it('accepts the server-owned workspace settings projection', () => {
    expect(parseWorkspaceSettings({ workspace })).toEqual(workspace);
  });

  it.each([
    ['missing workspace', {}],
    ['missing ID', { workspace: { ...workspace, id: '' } }],
    ['missing name', { workspace: { ...workspace, name: null } }],
    ['invalid role', { workspace: { ...workspace, role: 'admin' } }],
  ])('rejects %s', (_label, payload) => {
    expect(parseWorkspaceSettings(payload)).toBeNull();
  });
});
