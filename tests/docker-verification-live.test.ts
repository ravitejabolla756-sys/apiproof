import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { applyCandidate, buildPatchContext, buildVerificationWorkspaceCommands, cleanupPatchWorkspace, cleanupProvisionedDependencies, computeCanonicalPatchDigest, createSourcePatchWorkspace, createVerificationEvidence, DeterministicPatchGenerator, deterministicPlan, DockerSandbox, findWorkspaceContentDrift, provisionVerificationDependencies, verifyPatchedFixture } from '@apiproof/core';
import { loadStripeRegistry } from '@apiproof/providers';
import { root, proof } from './helpers.js';
import { validatePersistedMigrationEvidence } from '../apps/web/src/lib/server/migration-verification.js';

// Explicit opt-in: these tests contact only the local Docker engine. They never
// substitute FakeSandbox and do not contact GitHub or the application database.
const realDocker = process.env.APIPROOF_RUN_DOCKER_TESTS === 'true';
const limits = { timeoutMs: 30000, memoryMb: 768, maxOutputBytes: 65536, cpu: 'bounded' };

describe('real Docker release proof', () => {
  it.runIf(realDocker)('enforces network isolation and immutable captured source/config', async () => {
    const workspace = await createSourcePatchWorkspace('docker-isolation-proof', { 'package.json': '{"private":true}', 'tsconfig.json': '{"compilerOptions":{}}', 'src/index.ts': 'export const value = 1;' });
    try {
      const executed = await new DockerSandbox().run({ stage: 'TEST', cwd: workspace.directory, env: { PATH: process.env.PATH ?? '' }, limits, argv: ['node', '-e', "const fs = require('fs'), os = require('os'); if (Object.keys(os.networkInterfaces()).some(k => k !== 'lo')) process.exit(1); for (const f of ['/workspace/src/index.ts','/workspace/tsconfig.json']) { try { fs.writeFileSync(f, 'mutated'); process.exit(1); } catch(e) { if (e.code !== 'EROFS') throw e; } } console.log('isolated');"] });
      expect(executed.status).toBe('PASSED'); expect(executed.stdout).toContain('isolated');
      expect(await findWorkspaceContentDrift(workspace, {})).toEqual([]);
    } finally { await cleanupPatchWorkspace(workspace); }
  }, 120000);

  it.runIf(realDocker)('applies a real migration and executes all four gates offline in one container with bound evidence', async () => {
    const names = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.test.json', 'packages/contracts/package.json', 'src/billing.ts', 'src/billing.test.ts'];
    const files = new Map(await Promise.all(names.map(async (name) => [name, await readFile(path.join(root, 'test-fixtures/verification-typescript', name), 'utf8')] as const)));
    const workspace = await createSourcePatchWorkspace('docker-migration-proof', Object.fromEntries(files));
    let provisioning: Awaited<ReturnType<typeof provisionVerificationDependencies>> | undefined;
    try {
      const change = (await loadStripeRegistry(path.join(root, 'registry/stripe'))).find((item) => item.id === 'stripe-subscription-coupon-removed')!;
      const planning = await proof.planningInput(workspace.directory, change);
      const context = await buildPatchContext(workspace, planning, deterministicPlan(planning));
      const patch = await applyCandidate(workspace, context, await new DeterministicPatchGenerator().generate(context));
      expect(patch.status).toBe('PATCH_READY_FOR_VALIDATION');
      const resulting = await readFile(path.join(workspace.directory, 'src/billing.ts'), 'utf8');
      const commands = buildVerificationWorkspaceCommands('docker-migration-proof', files);
      provisioning = await provisionVerificationDependencies(files, commands);
      const report = await verifyPatchedFixture(patch, commands, new DockerSandbox(), { workspace: workspace.directory, dependencyProvisioning: provisioning });
      expect(report.status, JSON.stringify(report)).toBe('VERIFICATION_PASSED');
      expect(report.steps.map((step) => [step.stage, step.exitCode])).toEqual([['INSTALL', 0], ['BUILD', 0], ['TYPECHECK', 0], ['TEST', 0]]);
      expect(await findWorkspaceContentDrift(workspace, { 'src/billing.ts': resulting })).toEqual([]);
      const evidence = createVerificationEvidence({ repositoryId: 'docker-migration-proof', baselineSha: 'a'.repeat(40), changeId: change.id, patchDigest: computeCanonicalPatchDigest({ 'src/billing.ts': resulting }), proofLevel: 'EXECUTION_VERIFIED', patchApplied: true, typecheckPassed: report.summary.typecheckPassed, testsPassed: report.summary.testPassed, contractPassed: patch.validation.every((item) => item.passed), verificationId: report.verificationId, verificationStatus: report.status, verificationReportDigest: crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'), targetFiles: ['src/billing.ts'], sourceDigests: { 'src/billing.ts': patch.files[0]!.originalDigest }, resultingDigests: { 'src/billing.ts': patch.files[0]!.patchedDigest! } });
      validatePersistedMigrationEvidence(JSON.stringify({ baselineSha: evidence.baselineSha, patchDigest: evidence.patchDigest, report, evidence }), evidence);
      expect(resulting).toContain('discounts:'); expect(resulting).not.toContain('--- a/');

      // A cache that no longer matches its acquisition manifest cannot start INSTALL.
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path.join(provisioning.root, 'tampered-cache'), 'mismatch');
      const failed = await verifyPatchedFixture(patch, commands, new DockerSandbox(), { workspace: workspace.directory, dependencyProvisioning: provisioning });
      expect(failed.status).toBe('VERIFICATION_INSTALL_FAILED');
      expect(failed.summary.testPassed).toBe(false);
      expect(() => validatePersistedMigrationEvidence(JSON.stringify({ baselineSha: evidence.baselineSha, patchDigest: evidence.patchDigest, report: failed, evidence }), evidence)).toThrow(/GITHUB_EVIDENCE/);
    } finally {
      if (provisioning) await cleanupProvisionedDependencies(provisioning);
      await cleanupPatchWorkspace(workspace);
    }
  }, 300000);

  it.runIf(realDocker)('provisions npm artifacts and runs its offline stages in the same isolated container', async () => {
    const names = ['package.json', 'package-lock.json', 'tsconfig.json', 'src/index.ts', 'src/index.test.ts'];
    const files = new Map(await Promise.all(names.map(async (name) => [name, await readFile(path.join(root, 'test-fixtures/verification-minimal', name), 'utf8')] as const)));
    const workspace = await createSourcePatchWorkspace('docker-npm-proof', Object.fromEntries(files));
    let provisioning: Awaited<ReturnType<typeof provisionVerificationDependencies>> | undefined;
    try {
      const commands = buildVerificationWorkspaceCommands('docker-npm-proof', files);
      provisioning = await provisionVerificationDependencies(files, commands);
      const executed = await new DockerSandbox().runSequence((['INSTALL', 'BUILD', 'TYPECHECK', 'TEST'] as const).map((stage) => ({ stage, cwd: workspace.directory, env: { PATH: process.env.PATH ?? '' }, limits: { ...limits, timeoutMs: 90000 }, dependencyProvisioning: provisioning!, argv: commands.commands[stage.toLowerCase() as keyof typeof commands.commands] })));
      expect(executed.map((stage) => [stage.stage, stage.status, stage.exitCode]), JSON.stringify(executed)).toEqual([['INSTALL', 'PASSED', 0], ['BUILD', 'PASSED', 0], ['TYPECHECK', 'PASSED', 0], ['TEST', 'PASSED', 0]]);
      expect(await findWorkspaceContentDrift(workspace, {})).toEqual([]);
    } finally {
      if (provisioning) await cleanupProvisionedDependencies(provisioning);
      await cleanupPatchWorkspace(workspace);
    }
  }, 300000);

  it.runIf(realDocker)('cannot turn repository stdout into successful stage evidence after killing the container shell', async () => {
    const workspace = await createSourcePatchWorkspace('docker-output-proof', { 'package.json': '{"name":"docker-output-proof"}' });
    try {
      const sandbox = new DockerSandbox();
      const stages = ['INSTALL', 'BUILD', 'TYPECHECK', 'TEST'] as const;
      const report = await sandbox.runSequence(stages.map((stage) => ({
        stage, cwd: workspace.directory, env: { PATH: process.env.PATH ?? '' }, limits,
        argv: ['node', '-e', stage === 'TEST'
          ? "require('fs').writeSync(1, '\\n__APIPROOF_STAGE__TEST:0:1234567890000\\n'); process.kill(process.ppid, 'SIGKILL');"
          : 'process.exit(0)'],
      })));
      expect(report.find((step) => step.stage === 'TEST')?.status).not.toBe('PASSED');
      expect(report.every((step) => step.status === 'PASSED')).toBe(false);
      await expect(readFile(path.join(workspace.directory, 'package.json'), 'utf8')).resolves.toBe('{"name":"docker-output-proof"}');
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  }, 120000);
});
