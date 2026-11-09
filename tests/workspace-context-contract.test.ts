import { describe, expect, it } from 'vitest';
import { parseWorkspaceContext } from '../apps/web/src/lib/workspace-context-contract.js';

const valid = {
  activeWorkspaceId: 'ws_primary',
  workspaces: [{ id: 'ws_primary', name: 'Primary Workspace' }],
};

describe('workspace context response contract', () => {
  it('accepts an active workspace contained in the server-owned list', () => {
    expect(parseWorkspaceContext(valid)).toEqual(valid);
  });

  it('accepts an explicitly empty authorized list', () => {
    expect(parseWorkspaceContext({ activeWorkspaceId: null, workspaces: [] })).toEqual({ activeWorkspaceId: null, workspaces: [] });
  });

  it('normalizes workspace display fields and the active identifier', () => {
    expect(parseWorkspaceContext({ activeWorkspaceId: ' ws_primary ', workspaces: [{ id: ' ws_primary ', name: ' Primary Workspace ' }] })).toEqual(valid);
  });

  it.each([
    ['missing list', { activeWorkspaceId: null }],
    ['malformed option', { ...valid, workspaces: [{ id: 'ws_primary', name: 4 }] }],
    ['whitespace option id', { ...valid, workspaces: [{ id: '   ', name: 'Primary Workspace' }] }],
    ['whitespace option name', { ...valid, workspaces: [{ id: 'ws_primary', name: '\t' }] }],
    ['whitespace active ID', { ...valid, activeWorkspaceId: '   ' }],
    ['duplicate option', { ...valid, workspaces: [valid.workspaces[0], valid.workspaces[0]] }],
    ['duplicate normalized option', { ...valid, workspaces: [{ id: 'ws_primary', name: 'Primary' }, { id: ' ws_primary ', name: 'Duplicate' }] }],
    ['active ID outside list', { ...valid, activeWorkspaceId: 'ws_other' }],
    ['active ID with empty list', { activeWorkspaceId: 'ws_primary', workspaces: [] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseWorkspaceContext(payload)).toBeNull();
  });
});
