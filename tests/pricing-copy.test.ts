import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { billingCheckoutAvailability } from '../apps/web/src/lib/billing-checkout-contract.js';

describe('pricing-page capability contract', () => {
  it('describes the free beta and keeps paid plans display-only', () => {
    const source = fs.readFileSync(path.resolve('apps/web/src/app/pricing/page.tsx'), 'utf8');

    expect(source).toContain('Free Beta');
    expect(source).toContain('Free beta available now');
    expect(source).toContain('₹5,000');
    expect(source).toContain('₹15,000');
    expect(source).toContain('MY OWL Enterprise');
    expect(source).toContain('Custom');
    expect(source).toContain('Start an enterprise inquiry');
    expect(source).toContain('Organization-wide repository management');
    expect(source).toContain('Rolling out');
    expect(source).toContain('Coming soon');
    expect(source).toContain('billingCheckoutAvailability');
    expect(billingCheckoutAvailability.developerLabel).toContain('no checkout');
    expect(billingCheckoutAvailability.startupLabel).toContain('no checkout');
    expect(source).not.toContain('Start Pro Plan');
    expect(source).not.toContain('Start Team Plan');
  });
});
