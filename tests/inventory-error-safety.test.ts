import { afterEach, describe, expect, it, vi } from 'vitest';
import * as registryUtils from '../apps/web/src/lib/server/registry-utils.js';
import { GET as getInventory } from '../apps/web/src/app/api/inventory/route.js';

describe('inventory API error safety', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not return registry exception details to clients', async () => {
    const secretMarker = 'AWS_SECRET_ACCESS_KEY:INVENTORY_SECRET_MARKER';
    vi.spyOn(registryUtils, 'loadProviderRegistry').mockRejectedValue(new Error(secretMarker));

    const response = await getInventory(new Request('https://apiproof.test/api/inventory'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: 'Failed to load inventory.' });
    expect(JSON.stringify(body)).not.toContain(secretMarker);
  });
});
