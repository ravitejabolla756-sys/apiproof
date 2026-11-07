import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyCandidate,
  assertVerificationWorkspaceBounds,
  buildPatchContext,
  buildVerificationWorkspaceCommands,
  cleanupPatchWorkspace,
  patchWorkspaceRunsRoot,
  computeCanonicalPatchDigest,
  createVerificationEvidence,
  createSourcePatchWorkspace,
  DeterministicPatchGenerator,
  deterministicPlan,
  DockerSandbox,
  buildDockerRunArgs,
  assertProvisioningIntegrity,
  computeProvisioningInputDigest,
  FakeSandbox,
  findWorkspaceContentDrift,
  isVerificationWorkspacePath,
  verifyPatchedFixture,
} from '@apiproof/core';
import { loadStripeRegistry } from '@apiproof/providers';
import { proof, root } from './helpers.js';
import { validatePersistedMigrationEvidence } from '../apps/web/src/lib/server/migration-verification.js';

const fixtureRoot = path.join(root, 'test-fixtures/verification-typescript');
const sha256 = (value: string) => import('node:crypto').then(({ createHash }) => createHash('sha256').update(value.replace(/\r\n?/g, '\n')).digest('hex'));

async function fixtureFiles(): Promise<Record<string, string>> {
  const names = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.test.json', 'packages/contracts/package.json', 'src/billing.ts', 'src/billing.test.ts'];
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readFile(path.join(fixtureRoot, name), 'utf8')])));
}

describe('production verification workspace preparation', () => {
  it('builds valid pinned, network-disabled Docker arguments', () => {
    const args = buildDockerRunArgs({ stage: 'INSTALL', cwd: 'C:/workspace', argv: ['echo', 'ok'], env: {}, limits: { timeoutMs: 90000, memoryMb: 768, maxOutputBytes: 65536, cpu: 'bounded' } }, { timeoutMs: 90000, memoryMb: 768, maxOutputBytes: 65536, cpu: 'bounded' });
    expect(args).toContain('--pull=never');
    expect(args).toContain('--network=none');
    expect(args).toContain('COREPACK_ENABLE_NETWORK=0');
    expect(args).toContain('/root/.cache:rw,nosuid,size=64m');
    expect(args).toContain('type=bind,src=C:/workspace,dst=/workspace,readonly=true');
    expect(args.some((arg) => arg.endsWith(',rw'))).toBe(false);
  });

  it('derives a stable provisioning identity and rejects missing artifacts', async () => {
    const files = new Map([['package.json', '{"packageManager":"pnpm@10.30.3"}'], ['pnpm-lock.yaml', 'lockfileVersion: \'9.0\'\n']]);
    expect(computeProvisioningInputDigest(files)).toBe(computeProvisioningInputDigest(new Map([...files].reverse())));
    const root = path.join(rootDir(), `verification-provisioning-${Date.now()}`);
    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    await mkdir(path.join(root, 'pnpm-store'), { recursive: true });
    await writeFile(path.join(root, 'provisioning.json'), JSON.stringify({ packageManager: 'pnpm', inputDigest: 'wrong', artifactDigest: 'wrong' }));
    await expect(assertProvisioningIntegrity({ packageManager: 'pnpm', root, inputDigest: 'expected', artifactDigest: 'expected' }, 'pnpm')).rejects.toThrow(/VERIFICATION_PROVISIONING_INTEGRITY_FAILED/);
    await rm(root, { recursive: true, force: true });
  });

  it('preserves TypeScript, lockfile, package-manager and workspace metadata', async () => {
    const files = await fixtureFiles();
    files['.npmrc'] = 'strict-peer-dependencies=false\n';
    const workspace = await createSourcePatchWorkspace('repo-typescript-fixture', files);
    try {
      for (const name of Object.keys(files)) {
        await expect(readFile(path.join(workspace.directory, name), 'utf8')).resolves.toBe(files[name]);
      }
      const commands = buildVerificationWorkspaceCommands('typescript-fixture', new Map(Object.entries(files)));
      expect(commands).toMatchObject({ packageManager: 'pnpm', commands: { install: ['corepack', 'pnpm@10.30.3', 'install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--store-dir', '/provisioned-dependencies/pnpm-store'] } });
      expect(commands.commands.typecheck).toContain('tsc');
      expect(commands.commands.test).toContain('vitest');
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });

  it('uses the serverless writable temp directory instead of the package/build path', async () => {
    const workspace = await createSourcePatchWorkspace('serverless-runtime', {
      'package.json': '{"private":true}',
      'src/index.ts': 'export const value = 1;',
    });
    try {
      const tempRoot = realpathSync(os.tmpdir());
      const workspaceRoot = path.resolve(patchWorkspaceRunsRoot);
      expect(path.relative(tempRoot, workspaceRoot)).not.toMatch(/^\.\./);
      expect(path.relative(workspaceRoot, path.resolve(workspace.directory))).not.toMatch(/^\.\./);
      expect(workspace.directory).not.toMatch(/^[\\/]vercel(?:[\\/]|$)/i);
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });

  it('keeps sensitive and unrelated files out of the bounded snapshot', () => {
    for (const file of ['.env', 'secrets/token.ts', 'src/private-key.pem', 'node_modules/pkg/index.ts', 'README.md']) {
      expect(isVerificationWorkspacePath(file), file).toBe(false);
    }
    for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.yarnrc.yml', 'packages/api/tsconfig.build.json', 'apps/web/src/route.ts', 'lib/client.ts']) {
      expect(isVerificationWorkspacePath(file), file).toBe(true);
    }
  });

  it.each([
    ['npm', { 'package.json': '{"packageManager":"npm@10.9.2"}', 'package-lock.json': '{}' }, ['npm', 'ci', '--offline']],
    ['yarn', { 'package.json': '{"packageManager":"yarn@1.22.22"}', 'yarn.lock': '' }, ['corepack', 'yarn@1.22.22', 'install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--cache-folder', '/provisioned-dependencies/yarn-cache']],
  ])('preserves and selects the matching %s lockfile command set', (manager, contents, prefix) => {
    const commands = buildVerificationWorkspaceCommands('manager-test', new Map(Object.entries(contents)));
    expect(commands.packageManager).toBe(manager);
    expect(commands.commands.install.slice(0, prefix.length)).toEqual(prefix);
  });

  it('rejects embedded credentials in dependency/workspace metadata before copying', async () => {
    const files = await fixtureFiles();
    files['pnpm-lock.yaml'] = "lockfileVersion: '9.0'\nresolved: https://user:secret@registry.example/pkg\n";
    await expect(createSourcePatchWorkspace('repo-sensitive-fixture', files)).rejects.toThrow(/VERIFICATION_CREDENTIAL_MATERIAL_REJECTED/);
  });

  it('rejects authentication-bearing package-manager configuration', async () => {
    const files = await fixtureFiles();
    files['.npmrc'] = '//registry.example/:_authToken=private-token\n';
    await expect(createSourcePatchWorkspace('repo-sensitive-config', files)).rejects.toThrow(/VERIFICATION_CREDENTIAL_MATERIAL_REJECTED/);
  });

  it('rejects snapshots beyond the workspace file bound before materializing contents', () => {
    const files = new Map(Array.from({ length: 501 }, (_, index) => [`src/file-${index}.ts`, '']));
    expect(() => assertVerificationWorkspaceBounds(files)).toThrow(/VERIFICATION_WORKSPACE_FILE_LIMIT/);
  });

  it('detects sandbox changes to captured source and TypeScript configuration inputs', async () => {
    const files = await fixtureFiles();
    const workspace = await createSourcePatchWorkspace('repo-drift-fixture', files);
    try {
      await expect(findWorkspaceContentDrift(workspace, {})).resolves.toEqual([]);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path.join(workspace.directory, 'tsconfig.json'), '{"compilerOptions":{}}');
      await expect(findWorkspaceContentDrift(workspace, {})).resolves.toEqual(['tsconfig.json']);
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });

  it.each([
    ['missing lockfile', { files: { 'package.json': '{"name":"x"}' }, error: /VERIFICATION_LOCKFILE_REQUIRED/ }],
    ['conflicting lockfiles', { files: { 'package.json': '{"name":"x"}', 'pnpm-lock.yaml': '', 'package-lock.json': '{}' }, error: /VERIFICATION_LOCKFILE_REQUIRED/ }],
    ['manager mismatch', { files: { 'package.json': '{"packageManager":"npm@10.0.0"}', 'pnpm-lock.yaml': '' }, error: /VERIFICATION_LOCKFILE_MISMATCH/ }],
    ['unsupported Yarn Berry', { files: { 'package.json': '{"packageManager":"yarn@4.6.0"}', 'yarn.lock': '' }, error: /VERIFICATION_PACKAGE_MANAGER_UNSUPPORTED/ }],
  ])('fails closed for %s', (_name, spec) => {
    expect(() => buildVerificationWorkspaceCommands('fixture', new Map(Object.entries(spec.files)))).toThrow(spec.error);
  });

  it('applies the real deterministic TypeScript migration to the fixture source', async () => {
    const files = await fixtureFiles();
    const workspace = await createSourcePatchWorkspace('repo-typescript-fixture', files);
    try {
      const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
      const changeRecord = registry.find((candidate) => candidate.id === 'stripe-subscription-coupon-removed')!;
      const planning = await proof.planningInput(workspace.directory, changeRecord);
      const context = await buildPatchContext(workspace, planning, deterministicPlan(planning));
      const generated = await new DeterministicPatchGenerator().generate(context);
      const patch = await applyCandidate(workspace, context, generated);
      expect(patch.status).toBe('PATCH_READY_FOR_VALIDATION');
      expect(patch.files.map((file) => file.path)).toEqual(['src/billing.ts', 'src/billing.test.ts']);
      const resulting = await readFile(path.join(workspace.directory, 'src/billing.ts'), 'utf8');
      expect(resulting).toContain("subscriptions.create({ customer: 'cus_controlled', discounts: [{ coupon: 'launch' }] })");
      const resultingTest = await readFile(path.join(workspace.directory, 'src/billing.test.ts'), 'utf8');
      expect(resultingTest).toContain("discounts: [{ coupon: 'launch' }]");
      expect(resulting).not.toContain('--- a/');
      expect(patch.files[0]?.patchedDigest).toBe(await sha256(resulting));

      // This fake is explicit test-only coverage of the persisted evidence contract;
      // the DockerSandbox path is exercised separately and fails closed below.
      const fakeVerified = await verifyPatchedFixture(patch, buildVerificationWorkspaceCommands('test-only', new Map(Object.entries(files))), new FakeSandbox(), { workspace: workspace.directory });
      expect(fakeVerified.status).toBe('VERIFICATION_PASSED');
      const patchContent = { 'src/billing.ts': resulting, 'src/billing.test.ts': resultingTest };
      const targetFiles = patch.files.map((file) => file.path);
      const evidence = createVerificationEvidence({
        repositoryId: 'repo-typescript-fixture', baselineSha: 'a'.repeat(40), changeId: changeRecord.id,
        patchDigest: computeCanonicalPatchDigest(patchContent), proofLevel: 'CONTRACT_VERIFIED',
        patchApplied: true, typecheckPassed: fakeVerified.summary.typecheckPassed,
        testsPassed: fakeVerified.summary.testPassed, contractPassed: true,
        verificationId: fakeVerified.verificationId, verificationStatus: fakeVerified.status,
        verificationReportDigest: await sha256(JSON.stringify(fakeVerified)), targetFiles,
        sourceDigests: Object.fromEntries(patch.files.map((file) => [file.path, file.originalDigest])),
        resultingDigests: Object.fromEntries(patch.files.map((file) => [file.path, file.patchedDigest!])),
      });
      validatePersistedMigrationEvidence(JSON.stringify({ baselineSha: 'a'.repeat(40), patchDigest: evidence.patchDigest, report: fakeVerified, evidence }), {
        repositoryId: 'repo-typescript-fixture', baselineSha: 'a'.repeat(40), changeId: changeRecord.id, patchDigest: evidence.patchDigest,
      });
      const priorNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(() => validatePersistedMigrationEvidence(JSON.stringify({ baselineSha: 'a'.repeat(40), patchDigest: evidence.patchDigest, report: fakeVerified, evidence }), {
          repositoryId: 'repo-typescript-fixture', baselineSha: 'a'.repeat(40), changeId: changeRecord.id, patchDigest: evidence.patchDigest,
        })).toThrow(/GITHUB_EVIDENCE_INCOMPLETE: Production proposal evidence must be execution-verified/);
      } finally {
        if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = priorNodeEnv;
      }
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });

  it('runs the real orchestrator and DockerSandbox boundary, failing closed when Docker is unavailable', async () => {
    const files = await fixtureFiles();
    const workspace = await createSourcePatchWorkspace('repo-typescript-fixture', files);
    try {
      const registry = await loadStripeRegistry(path.join(root, 'registry/stripe'));
      const changeRecord = registry.find((candidate) => candidate.id === 'stripe-subscription-coupon-removed')!;
      const planning = await proof.planningInput(workspace.directory, changeRecord);
      const context = await buildPatchContext(workspace, planning, deterministicPlan(planning));
      const patch = await applyCandidate(workspace, context, await new DeterministicPatchGenerator().generate(context));
      const commands = buildVerificationWorkspaceCommands('typescript-fixture', new Map(Object.entries(files)));
      const report = await verifyPatchedFixture(patch, commands, new DockerSandbox('apiproof-docker-unavailable-test'), { workspace: workspace.directory });
      expect(report.status).toBe('VERIFICATION_INSTALL_FAILED');
      expect(report.steps).toHaveLength(0);
      expect(report.warnings).toContain('Deterministic offline dependency provisioning is required before Docker verification.');
      expect(report.networkPolicy).toMatchObject({ mode: 'NETWORK_DISABLED', enforced: true });
      expect(report.summary).toMatchObject({ buildPassed: false, typecheckPassed: false, testPassed: false });
      const patchContent = { 'src/billing.ts': await readFile(path.join(workspace.directory, 'src/billing.ts'), 'utf8') };
      const evidence = createVerificationEvidence({
        repositoryId: 'repo-typescript-fixture', baselineSha: 'a'.repeat(40), changeId: patch.changeId,
        patchDigest: computeCanonicalPatchDigest(patchContent), proofLevel: 'EXECUTION_VERIFIED',
        patchApplied: true, typecheckPassed: report.summary.typecheckPassed, testsPassed: report.summary.testPassed,
        contractPassed: true, verificationId: report.verificationId, verificationStatus: report.status,
        verificationReportDigest: await sha256(JSON.stringify(report)), targetFiles: ['src/billing.ts'],
        sourceDigests: { 'src/billing.ts': patch.files[0]!.originalDigest },
        resultingDigests: { 'src/billing.ts': patch.files[0]!.patchedDigest! },
      });
      expect(() => validatePersistedMigrationEvidence(JSON.stringify({ baselineSha: 'a'.repeat(40), patchDigest: evidence.patchDigest, report, evidence }), {
        repositoryId: 'repo-typescript-fixture', baselineSha: 'a'.repeat(40), changeId: patch.changeId, patchDigest: evidence.patchDigest,
      })).toThrow(/GITHUB_EVIDENCE_STALE/);
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });
});

function rootDir(): string { return path.join(root, '.tmp'); }
