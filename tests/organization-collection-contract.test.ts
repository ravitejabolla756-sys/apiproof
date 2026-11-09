import { describe, expect, it } from 'vitest';
import { parseInvitationCollection, parseMemberCollection } from '../apps/web/src/lib/organization-collection-contract.js';

const member = { id: 'member-1', userId: 'user-1', email: 'member@example.test', name: 'Member', role: 'member', createdAt: '2026-11-09T00:00:00.000Z' } as const;
const invitation = { id: 'invite-1', email: 'invite@example.test', role: 'member', expiresAt: '2026-11-16T00:00:00.000Z', acceptedAt: null, revokedAt: null, createdAt: '2026-11-09T00:00:00.000Z' } as const;

describe('organization collection response contracts', () => {
  it('accepts valid member and invitation collections', () => {
    expect(parseMemberCollection({ members: [member] })).toEqual([member]);
    expect(parseInvitationCollection({ invitations: [invitation] })).toEqual([invitation]);
  });

  it.each([
    ['missing members', { members: null }],
    ['malformed member role', { members: [{ ...member, role: 'admin' }] }],
    ['duplicate members', { members: [member, member] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseMemberCollection(payload)).toBeNull();
  });

  it.each([
    ['missing invitations', { invitations: null }],
    ['malformed invitation date', { invitations: [{ ...invitation, expiresAt: 4 }] }],
    ['malformed invitation state', { invitations: [{ ...invitation, acceptedAt: 4 }] }],
    ['duplicate invitations', { invitations: [invitation, invitation] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseInvitationCollection(payload)).toBeNull();
  });
});
