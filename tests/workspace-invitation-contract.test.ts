import { describe, expect, it } from 'vitest';
import { parseAcceptedInvitationResponse } from '../apps/web/src/lib/workspace-invitation-contract.js';

describe('accepted invitation response contract', () => {
  it('normalizes a valid workspace projection', () => {
    expect(parseAcceptedInvitationResponse({ workspace: { name: '  Platform Team  ' } })).toEqual({ workspaceName: 'Platform Team' });
  });

  it('rejects missing, blank and malformed workspace names', () => {
    expect(parseAcceptedInvitationResponse({})).toBeNull();
    expect(parseAcceptedInvitationResponse({ workspace: { name: '   ' } })).toBeNull();
    expect(parseAcceptedInvitationResponse({ workspace: { name: 42 } })).toBeNull();
  });
});
