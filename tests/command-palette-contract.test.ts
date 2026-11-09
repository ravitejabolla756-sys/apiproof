import { describe, expect, it } from 'vitest';
import { parseCommandPaletteResponse } from '../apps/web/src/lib/command-palette-contract.js';

describe('command palette response', () => {
  it('accepts the minimal repository and inventory projections', () => {
    expect(parseCommandPaletteResponse({
      repositories: [{ id: 'repo-1', name: 'owl', full_name: 'acme/owl', status: 'healthy', findings_count: 2 }],
      providers: [{ id: 'provider-1', name: 'Stripe', category: 'payments', rulesCount: 3 }],
    })).toEqual({
      repositories: [{ id: 'repo-1', name: 'owl', full_name: 'acme/owl', status: 'healthy', findings_count: 2 }],
      providers: [{ id: 'provider-1', name: 'Stripe', category: 'payments', rulesCount: 3 }],
    });
  });

  it('allows valid empty collections', () => {
    expect(parseCommandPaletteResponse({ repositories: [], providers: [] })).toEqual({ repositories: [], providers: [] });
  });

  it('rejects incomplete, negative or duplicate projections', () => {
    expect(parseCommandPaletteResponse({ repositories: [{ id: 'repo-1' }], providers: [] })).toBeNull();
    expect(parseCommandPaletteResponse({ repositories: [{ id: 'repo-1', name: 'owl', full_name: 'acme/owl', status: 'healthy', findings_count: -1 }], providers: [] })).toBeNull();
    expect(parseCommandPaletteResponse({ repositories: [], providers: [{ id: 'provider-1', name: 'Stripe', category: 'payments', rulesCount: 1 }, { id: 'provider-1', name: 'Stripe', category: 'payments', rulesCount: 1 }] })).toBeNull();
  });
});
