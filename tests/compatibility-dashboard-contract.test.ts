import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dashboardSource = fs.readFileSync(path.resolve('apps/web/src/app/dashboard/compatibility/page.tsx'), 'utf8');
const contractSource = fs.readFileSync(path.resolve('apps/web/src/lib/compatibility-proof-contract.ts'), 'utf8');

describe('compatibility dashboard reviewed-rule contract', () => {
  it('renders model and resource scoped reviewed rules from the proof API shape', () => {
    expect(contractSource).toContain('affectedModels: string[]');
    expect(contractSource).toContain('affectedResources: string[]');
    expect(contractSource).toContain('affectedResponseFields: string[]');
    expect(dashboardSource).toContain('change.affectedModels');
    expect(dashboardSource).toContain('change.affectedResources');
    expect(dashboardSource).toContain('change.affectedResponseFields');
    expect(dashboardSource).toContain('change.replacement?.model');
    expect(dashboardSource).toContain('change.replacement.resources');
  });
});
