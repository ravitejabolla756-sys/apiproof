import { describe, expect, it } from 'vitest';
import { loginDestination, safeNextPath } from '../apps/web/src/lib/auth-redirect-contract.js';

describe('authentication redirect contract', () => {
  const origin = 'https://apiproof.test';

  it('preserves middleware return paths supplied through from', () => {
    expect(loginDestination('?from=%2Fdashboard%2Fsettings%2Fworkspace%3Ftab%3Daudit', origin)).toBe('/dashboard/settings/workspace?tab=audit');
  });

  it('prefers the explicit next parameter used by OAuth and invitation flows', () => {
    expect(loginDestination('?from=%2Fdashboard&next=%2Finvite%2Faccept%3Ftoken%3Dabc', origin)).toBe('/invite/accept?token=abc');
  });

  it.each([
    ['//evil.example/path', '/dashboard'],
    ['https://evil.example/path', '/dashboard'],
    ['/dashboard\\evil', '/dashboard'],
    ['', '/dashboard'],
  ])('rejects unsafe redirect %s', (value, expected) => {
    expect(safeNextPath(value, origin)).toBe(expected);
  });
});
