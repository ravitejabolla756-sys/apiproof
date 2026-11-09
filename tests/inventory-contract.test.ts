import { describe, expect, it } from 'vitest';
import { parseInventoryResponse } from '../apps/web/src/lib/inventory-contract.js';

const provider = {
  id: 'openai', name: 'OpenAI', category: 'AI / Models', status: 'reviewed', rulesCount: 1,
  description: 'Reviewed provider.', rules: [{ id: 'rule-1', title: 'Retired API', severity: 'high', description: 'Review required.' }],
};

describe('inventory response', () => {
  it('accepts provider fixtures with optional capability metadata', () => {
    expect(parseInventoryResponse({ providers: [provider] })).toEqual([provider]);
  });

  it('rejects duplicate or malformed providers before filtering', () => {
    expect(parseInventoryResponse({ providers: [provider, provider] })).toBeNull();
    expect(parseInventoryResponse({ providers: [{ ...provider, rules: [{ ...provider.rules[0], title: '' }] }] })).toBeNull();
  });
});
