import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

describe('dependency security contract', () => {
  it('keeps the production audit threshold and reviewed overrides explicit', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      pnpm?: { overrides?: Record<string, string> };
    };
    expect(packageJson.scripts?.['audit:prod']).toBe('pnpm audit --prod --audit-level=high');
    expect(packageJson.pnpm?.overrides).toEqual({
      'brace-expansion': '5.0.12',
      minimatch: '11.0.1',
      postcss: '8.5.28',
      'source-map-js': '1.2.2',
    });
  });

  it('requires CI to enforce the same audit command after frozen installation', () => {
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain('run: pnpm install --frozen-lockfile');
    expect(workflow).toContain('run: pnpm audit:prod');
  });
});
