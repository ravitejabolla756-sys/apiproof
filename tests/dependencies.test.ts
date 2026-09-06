import { describe, expect, it } from 'vitest';
import { proof, repository } from './helpers.js';

describe('package metadata', () => {
  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])(
    'detects %s without treating its range as an installed version', async (section) => {
      const directory = await repository({ 'package.json': JSON.stringify({ [section]: { stripe: '^16.0.0' } }) });
      const scan = await proof.scan(directory);
      expect(scan.dependencies[0]).toMatchObject({ declarations: [{ section, range: '^16.0.0' }], installedVersion: null, lockedVersion: null });
    },
  );

  it('reports installed versions and drift separately from locked versions', async () => {
    const directory = await repository({
      'node_modules/stripe/package.json': '{"name":"stripe","version":"16.9.0"}',
      'node_modules/stripe/index.ts': `throw new Error('MUST_NOT_RUN_OR_SCAN');`,
      'package-lock.json': '{"lockfileVersion":3,"packages":{"node_modules/stripe":{"version":"16.12.0"}}}',
    });
    const scan = await proof.scan(directory);
    expect(scan.dependencies[0]).toMatchObject({ installedVersion: '16.9.0', lockedVersion: '16.12.0' });
    expect(scan.diagnostics.map((diagnostic) => diagnostic.code)).toContain('VERSION_DRIFT');
    expect(scan.coverage.filesAnalyzed).toBe(0);
  });

  it('does not select a version when two lockfiles disagree', async () => {
    const directory = await repository({
      'package-lock.json': '{"lockfileVersion":3,"packages":{"node_modules/stripe":{"version":"16.12.0"}}}',
      'pnpm-lock.yaml': `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      stripe:\n        version: 17.0.0\n`,
    });
    const scan = await proof.scan(directory);
    expect(scan.dependencies[0]?.lockedVersion).toBeNull();
    expect(scan.diagnostics.map((diagnostic) => diagnostic.code)).toContain('LOCKFILE_CONFLICT');
  });

  it('reads pnpm workspace importer versions instead of unrelated package snapshots', async () => {
    const directory = await repository({
      'package.json': '{"name":"root","private":true}',
      'apps/billing/package.json': '{"dependencies":{"stripe":"^16"}}',
      'pnpm-lock.yaml': `lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/billing:\n    dependencies:\n      stripe:\n        version: 16.12.0\npackages:\n  stripe@18.0.0: {}\n`,
    });
    const scan = await proof.scan(directory);
    expect(scan.dependencies).toHaveLength(1);
    expect(scan.dependencies[0]).toMatchObject({ manifest: 'apps/billing/package.json', lockedVersion: '16.12.0' });
  });

  it('supports npm v1 and pnpm v6 metadata', async () => {
    const npm = await repository({ 'package-lock.json': '{"lockfileVersion":1,"dependencies":{"stripe":{"version":"16.12.0"}}}' });
    const pnpm = await repository({ 'pnpm-lock.yaml': `lockfileVersion: '6.0'\ndependencies:\n  stripe:\n    specifier: ^16\n    version: 16.12.0\n` });
    expect((await proof.scan(npm)).dependencies[0]?.lockedVersion).toBe('16.12.0');
    expect((await proof.scan(pnpm)).dependencies[0]?.lockedVersion).toBe('16.12.0');
  });

  it('handles malformed and unsupported metadata conservatively', async () => {
    const directory = await repository({ 'pnpm-lock.yaml': 'lockfileVersion: 99', 'package-lock.json': '{SECRET_BAD_JSON' });
    const scan = await proof.scan(directory);
    expect(scan.dependencies[0]?.lockedVersion).toBeNull();
    expect(scan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(['INVALID_METADATA', 'UNSUPPORTED_LOCKFILE']));
    expect(JSON.stringify(scan)).not.toContain('SECRET_BAD_JSON');
  });

  it('rejects malformed root manifests with a safe error', async () => {
    const directory = await repository({ 'package.json': '{secret' });
    await expect(proof.scan(directory)).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
  });
});
