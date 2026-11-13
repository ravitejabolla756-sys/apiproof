import { describe, expect, it } from 'vitest';
import { mergeAuditEvents, parseAuditPage } from '../apps/web/src/lib/organization-audit-contract.js';

const validEvent = {
  id: 'audit-1',
  action: 'workspace.updated',
  targetType: 'workspace',
  actorEmail: 'owner@example.test',
  createdAt: '2026-11-09T00:00:00.000Z',
  metadata: { source: 'settings' },
};

describe('organization audit response contract', () => {
  it('accepts a bounded audit page and normalizes an omitted cursor', () => {
    expect(parseAuditPage({ events: [validEvent] })).toEqual({ events: [validEvent], nextCursor: null });
  });

  it('normalizes event text and catches duplicate IDs after normalization', () => {
    expect(parseAuditPage({
      events: [{ ...validEvent, id: ' audit-1 ', action: ' workspace.updated ', targetType: ' workspace ', actorEmail: ' owner@example.test ' }],
      nextCursor: ' cursor-1 ',
    })).toEqual({ events: [validEvent], nextCursor: 'cursor-1' });
    expect(parseAuditPage({
      events: [validEvent, { ...validEvent, id: ' audit-1 ', action: 'member.updated' }],
    })).toBeNull();
  });

  it('merges cursor pages only when event IDs remain unique', () => {
    const current = [validEvent];
    const next = [{ ...validEvent, id: 'audit-2', action: 'member.updated' }];
    expect(mergeAuditEvents(current, next)).toEqual([...current, ...next]);
    expect(mergeAuditEvents(current, [validEvent])).toBeNull();
    expect(mergeAuditEvents([validEvent, validEvent], [])).toBeNull();
  });

  it.each([
    ['missing events', { nextCursor: null }],
    ['missing event ID', { events: [{ ...validEvent, id: '' }] }],
    ['invalid actor', { events: [{ ...validEvent, actorEmail: 4 }] }],
    ['invalid metadata', { events: [{ ...validEvent, metadata: 'secret' }] }],
    ['duplicate event IDs', { events: [validEvent, validEvent] }],
    ['invalid cursor', { events: [], nextCursor: 4 }],
    ['empty cursor', { events: [], nextCursor: '   ' }],
  ])('rejects %s', (_label, payload) => {
    expect(parseAuditPage(payload)).toBeNull();
  });
});
