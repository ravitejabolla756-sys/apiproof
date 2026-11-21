import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('pricing-page capability contract', () => {
  it('describes the free beta and keeps paid plans display-only', () => {
    const source = fs.readFileSync(path.resolve('apps/web/src/app/pricing/page.tsx'), 'utf8');

    expect(source).toContain('Free Beta');
    expect(source).toContain('Free beta available now');
    expect(source).toContain('₹4,999');
    expect(source).toContain('₹14,999');
    expect(source).toContain('MY OWL Enterprise');
    expect(source).toContain('Custom');
    expect(source).toContain('Organization-wide repository management');
    expect(source).toContain('Rolling out');
    expect(source).toContain('Coming soon');
    expect(source).toContain('Coming Soon');
    expect(source).toContain('mailto:support@myowl.dev');
    expect(source).toContain('disabled');
    expect(source).not.toContain('Not available');
    expect(source).not.toContain('Contact Sales');
    expect(source).not.toContain('Rolling out — no checkout');
    expect(source).not.toContain('Coming soon — no checkout');
    expect(source).not.toContain('Start Pro Plan');
    expect(source).not.toContain('Start Team Plan');
  });
});
