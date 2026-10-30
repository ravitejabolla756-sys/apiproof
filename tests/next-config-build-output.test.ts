import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Next.js production build output', () => {
  it('uses an isolated output directory on Windows', () => {
    const source = fs.readFileSync(path.resolve('apps/web/next.config.js'), 'utf8');
    expect(source).toContain("process.platform === 'win32' ? '.next-release' : '.next'");
  });

  it('enables the Next build worker for Windows release verification', () => {
    const source = fs.readFileSync(path.resolve('apps/web/next.config.js'), 'utf8');
    expect(source).toContain("webpackBuildWorker: process.platform === 'win32'");
  });
});
