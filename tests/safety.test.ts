import { lstat, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { change, proof, repository } from './helpers.js';

async function snapshot(directory: string, relative = ''): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await snapshot(directory, file));
    else if (entry.isFile()) result[file] = (await readFile(path.join(directory, file))).toString('base64');
  }
  return result;
}

describe('read-only and bounded analysis', () => {
  it('does not invoke package scripts, load tsconfig extensions, or alter repository contents', async () => {
    const directory = await repository({
      'package.json': JSON.stringify({ dependencies: { stripe: '^16' }, scripts: { prepare: 'node should-never-run.cjs', test: 'node should-never-run.cjs' } }),
      'should-never-run.cjs': `require('fs').writeFileSync('EXECUTED', 'unsafe');`,
      'tsconfig.json': JSON.stringify({ extends: './should-never-run.cjs', compilerOptions: { plugins: [{ name: './should-never-run.cjs' }] } }),
      'src.ts': `import Stripe from 'stripe'; const client = new Stripe('sk_test_SENSITIVE_LITERAL'); client.customers.retrieve('');`,
      '.env': 'STRIPE_SECRET_KEY=SECRET_ENV',
    });
    const before = await snapshot(directory);
    const result = await proof.impact(directory, change);
    expect(await snapshot(directory)).toEqual(before);
    expect(JSON.stringify(result)).not.toContain('SENSITIVE_LITERAL');
    expect(JSON.stringify(result)).not.toContain('SECRET_ENV');
  });

  it('skips oversized source files and reports incomplete coverage', async () => {
    const directory = await repository({ 'huge.ts': ' '.repeat(1_048_577) });
    const result = await proof.impact(directory, change);
    expect(result.scan.coverage).toMatchObject({ complete: false, filesAnalyzed: 0, filesSkipped: 1 });
    expect(result.scan.diagnostics[0]?.code).toBe('SIZE_LIMIT');
    expect(result.status).toBe('inconclusive');
  });

  it('skips external directory symlinks without reading their TypeScript', async () => {
    const external = await repository({ 'outside.ts': `import Stripe from 'stripe'; const client = new Stripe(''); client.customers.retrieve('');` });
    const directory = await repository();
    // Directory junctions do not require Windows Developer Mode or administrator privileges.
    const target = path.join(directory, 'linked');
    await symlink(external, target, process.platform === 'win32' ? 'junction' : 'dir');
    expect((await lstat(target)).isSymbolicLink()).toBe(true);
    const scan = await proof.scan(directory);
    expect(scan.usages).toEqual([]);
    expect(scan.diagnostics.map((item) => item.code)).toContain('SYMLINK_SKIPPED');
  });

  it('flags computed method calls as unresolved', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe'; const client = new Stripe(''); client.customers[method]('');` });
    const result = await proof.impact(directory, change);
    expect(result.scan.diagnostics.map((item) => item.code)).toContain('DYNAMIC_MEMBER');
    expect(result.status).toBe('inconclusive');
  });

  it('changes the audit digest when analyzed input changes', async () => {
    const directory = await repository({ 'src.ts': 'export const value = 1;' });
    const before = await proof.scan(directory);
    await writeFile(path.join(directory, 'src.ts'), 'export const value = 2;');
    const after = await proof.scan(directory);
    expect(after.audit.inputDigest).not.toBe(before.audit.inputDigest);
  });

  it('does not accept YAML duplicate keys', async () => {
    const directory = await repository({ 'pnpm-lock.yaml': 'lockfileVersion: 9\nlockfileVersion: 6\n' });
    const scan = await proof.scan(directory);
    expect(scan.diagnostics.map((item) => item.code)).toContain('INVALID_LOCKFILE');
  });
});
