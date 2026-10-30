import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('pricing-page capability contract', () => {
  it('describes the guarded Draft PR boundary without claiming a read-only-only beta', () => {
    const source = fs.readFileSync(path.resolve('apps/web/src/app/pricing/page.tsx'), 'utf8');

    expect(source).not.toContain('No Draft PRs in beta');
    expect(source).not.toContain('reviewed Stripe and Twilio compatibility rules');
    expect(source).toContain('Guarded Draft Pull Requests are quota-limited to 2 on Free, 20 on Pro, and 100 on Team');
    expect(source).toContain('only when the workspace has remaining Draft PR quota');
    expect(source).toContain('Automatic merges and direct default-branch writes remain disabled');
    expect(source).toContain('Findings without quota or a verified remediation template remain evidence-only');
    expect(source).toContain('reviewed provider catalog');
  });
});
