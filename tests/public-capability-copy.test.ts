import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const publicSources = [
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/about/page.tsx',
  'apps/web/src/app/contact/page.tsx',
  'apps/web/src/app/docs/page.tsx',
  'apps/web/src/components/dashboard/scan-progress.tsx',
  'docs/apiproof-v1-documentation.md',
];

describe('public capability copy contract', () => {
  it('does not present the current catalog as Stripe/Twilio-only', () => {
    const source = publicSources.map((file) => fs.readFileSync(path.resolve(file), 'utf8')).join('\n');

    expect(source).not.toContain('reviewed Stripe and Twilio');
    expect(source).not.toContain('Stripe + Twilio compatibility rules');
    expect(source).not.toContain('defaults to Stripe analysis');
    expect(source).toContain('reviewed provider catalog');
  });
});
