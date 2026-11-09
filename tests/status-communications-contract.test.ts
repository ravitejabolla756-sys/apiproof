import { describe, expect, it } from 'vitest';
import { statusSourceAvailability } from '../apps/web/src/lib/status-communications-contract.js';

describe('status communications contract boundary', () => {
  it('keeps the public source unavailable until an approved monitor is configured', () => {
    expect(statusSourceAvailability).toEqual({
      status: 'unavailable',
      code: 'STATUS_SOURCE_NOT_CONFIGURED',
      message: 'No live monitor is connected to this public page yet, so it intentionally does not publish invented uptime, incident or “all systems operational” claims.',
    });
  });
});
