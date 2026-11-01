import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('pricing-page capability contract', () => {
  it('describes the guarded Draft PR boundary without claiming a read-only-only beta', () => {
    const source = fs.readFileSync(path.resolve('apps/web/src/app/pricing/page.tsx'), 'utf8');

    expect(source).not.toContain('No Draft PRs in beta');
    expect(source).not.toContain('reviewed Stripe and Twilio compatibility rules');
    expect(source).toContain('verified draft PR generation');
    expect(source).toContain('zero auto-merge capability');
    expect(source).toContain('isolated branch');
  });
});
