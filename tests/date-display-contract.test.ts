import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatDisplayDateTime, toSafeDisplayDateTime } from '../apps/web/src/lib/date-display-contract.js';

describe('workspace date display boundary', () => {
  it('accepts valid timestamps and formats them for display', () => {
    const value = '2026-11-09T00:00:00.000Z';
    expect(toSafeDisplayDateTime(value)).toBe(value);
    expect(formatDisplayDate(value)).not.toBe('Unavailable');
    expect(formatDisplayDateTime(value)).not.toBe('Unavailable');
  });

  it('fails closed for missing, malformed and impossible calendar values', () => {
    for (const value of [null, undefined, '', 'not-a-date', '2026-02-31T00:00:00.000Z']) {
      expect(toSafeDisplayDateTime(value)).toBeNull();
      expect(formatDisplayDate(value)).toBe('Unavailable');
      expect(formatDisplayDateTime(value)).toBe('Unavailable');
    }
  });
});
