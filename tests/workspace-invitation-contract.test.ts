import { describe, expect, it } from 'vitest';
import { parseAcceptedInvitationResponse, parseCreatedInvitationResponse, parseRevokedInvitationResponse } from '../apps/web/src/lib/workspace-invitation-contract.js';

describe('accepted invitation response contract', () => {
  it('normalizes a valid workspace projection', () => {
    expect(parseAcceptedInvitationResponse({ workspace: { name: '  Platform Team  ' } })).toEqual({ workspaceName: 'Platform Team' });
  });

  it('rejects missing, blank and malformed workspace names', () => {
    expect(parseAcceptedInvitationResponse({})).toBeNull();
    expect(parseAcceptedInvitationResponse({ workspace: { name: '   ' } })).toBeNull();
    expect(parseAcceptedInvitationResponse({ workspace: { name: 42 } })).toBeNull();
  });

  it('normalizes and validates invitation creation responses', () => {
    expect(parseCreatedInvitationResponse({ inviteUrl: '  /invite/accept?token=abc  ' })).toEqual({ inviteUrl: '/invite/accept?token=abc' });
    expect(parseCreatedInvitationResponse({ inviteUrl: '   ' })).toBeNull();
    expect(parseCreatedInvitationResponse({ inviteUrl: 42 })).toBeNull();
  });

  it('requires the explicit revocation success marker', () => {
    expect(parseRevokedInvitationResponse({ success: true })).toEqual({ success: true });
    expect(parseRevokedInvitationResponse({ success: false })).toBeNull();
    expect(parseRevokedInvitationResponse({})).toBeNull();
  });
});
