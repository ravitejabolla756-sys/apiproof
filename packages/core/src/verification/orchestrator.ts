import { randomUUID } from 'node:crypto';
import type { CandidatePatch, VerificationLimits, VerificationReport } from '@apiproof/shared';
import { VerificationReportSchema, VerificationLimitsSchema } from '@apiproof/shared';
import { DockerSandbox, VERIFICATION_DOCKER_IMAGE, type ExecutionSandbox } from './sandbox.js';
import type { DependencyProvisioning } from './provisioning.js';
import { assertProvisioningIntegrity } from './provisioning.js';
import { buildVerificationWorkspaceCommands, type VerificationPackageManager } from './workspace.js';

export interface VerificationFixture { id: string; patchFixtureId?: string; executionAllowed: boolean; packageManager: VerificationPackageManager; commands: { install: string[]; build: string[]; typecheck: string[]; test: string[] }; expected?: { original?: Record<string,string>; patched?: Record<string,string> } }
const stages=['INSTALL','BUILD','TYPECHECK','TEST'] as const;
export async function verifyPatchedFixture(patch: CandidatePatch, fixture: VerificationFixture, sandbox: ExecutionSandbox, options?: { limits?: VerificationLimits; workspace?: string; dependencyProvisioning?: DependencyProvisioning }): Promise<VerificationReport> {
  const limits=VerificationLimitsSchema.parse(options?.limits ?? {timeoutMs:90000,memoryMb:768,maxOutputBytes:65536,cpu:'bounded'}); const workspace=options?.workspace ?? patch.generatedBy.workspace;
  if (!fixture.executionAllowed) return VerificationReportSchema.parse(base(patch,fixture,workspace,'VERIFICATION_NOT_ALLOWED',[],limits,['Fixture is not registered for execution.']));
  if (process.env.NODE_ENV === 'production' && !(sandbox instanceof DockerSandbox)) return VerificationReportSchema.parse(base(patch,fixture,workspace,'VERIFICATION_POLICY_REJECTED',[],limits,['Production verification requires Docker execution.']));
  let canonical: VerificationFixture['commands'] | null = null;
  try { canonical = canonicalCommands(fixture); } catch { /* Invalid manager metadata fails closed. */ }
  if (!canonical || JSON.stringify(fixture.commands) !== JSON.stringify(canonical)) return VerificationReportSchema.parse(base(patch,fixture,workspace,'VERIFICATION_POLICY_REJECTED',[],limits,['Fixture command manifest is not APIProof-controlled.']));
  if (patch.status !== 'PATCH_READY_FOR_VALIDATION') return VerificationReportSchema.parse(base(patch,fixture,workspace,'VERIFICATION_POLICY_REJECTED',[],limits,['Only statically validated candidates may execute.']));
  if (sandbox instanceof DockerSandbox && !options?.dependencyProvisioning) return VerificationReportSchema.parse(base(patch,fixture,workspace,'VERIFICATION_INSTALL_FAILED',[],limits,['Deterministic offline dependency provisioning is required before Docker verification.']));
  if (sandbox instanceof DockerSandbox && options?.dependencyProvisioning) {
    try { await assertProvisioningIntegrity(options.dependencyProvisioning, fixture.packageManager, workspace); }
    catch (error) { return VerificationReportSchema.parse(base(patch,fixture,workspace,'VERIFICATION_INSTALL_FAILED',[],limits,[error instanceof Error ? error.message : String(error)])); }
  }
  const steps=[]; let failure: VerificationReport['status']|null=null;
  const requests = stages.map((stage) => ({ stage, cwd: workspace, argv: fixture.commands[stage.toLowerCase() as keyof VerificationFixture['commands']], env: { PATH: process.env.PATH ?? '', CI: 'true', NODE_ENV: 'test' }, limits, ...(options?.dependencyProvisioning ? { dependencyProvisioning: options.dependencyProvisioning } : {}) }));
  const executed = [];
  if (sandbox instanceof DockerSandbox) executed.push(...await sandbox.runSequence(requests));
  else for (const request of requests) { const step = await sandbox.run(request); executed.push(step); if (step.status !== 'PASSED' || step.exitCode !== 0) break; }
  for (const [index, step] of executed.entries()) { steps.push(step); if(step.stage !== stages[index]){failure='VERIFICATION_SANDBOX_FAILED';break;} if(step.status==='TIMED_OUT'){failure='VERIFICATION_TIMED_OUT';break;} if(step.status!=='PASSED' || step.exitCode !== 0){failure=step.stage==='INSTALL'?'VERIFICATION_INSTALL_FAILED':step.stage==='BUILD'?'VERIFICATION_BUILD_FAILED':step.stage==='TYPECHECK'?'VERIFICATION_TYPECHECK_FAILED':'VERIFICATION_TEST_FAILED';break;} }
  if (!failure && steps.length !== stages.length) failure = 'VERIFICATION_SANDBOX_FAILED';
  const build=steps.find(s=>s.stage==='BUILD')?.status==='PASSED', typecheck=steps.find(s=>s.stage==='TYPECHECK')?.status==='PASSED', test=steps.find(s=>s.stage==='TEST')?.status==='PASSED';
  const report = base(patch,fixture,workspace,failure ?? 'VERIFICATION_PASSED',steps,limits,['Configured isolated checks only; this is not a guarantee of production safety.'],{buildPassed:build,typecheckPassed:typecheck,testPassed:test});
  report.environment.runtime = sandbox instanceof DockerSandbox ? 'DockerSandbox' : 'test-only sandbox';
  report.environment.node = sandbox instanceof DockerSandbox ? VERIFICATION_DOCKER_IMAGE : process.version;
  return VerificationReportSchema.parse(report);
}
function canonicalCommands(fixture: VerificationFixture): VerificationFixture['commands'] | null {
  const versionedManager = fixture.commands.install[0] === 'npm' ? 'npm' : fixture.commands.install[0] === 'corepack' ? fixture.commands.install[1] : undefined;
  if (!versionedManager) return null;
  const manager = versionedManager === 'npm' ? 'npm' : versionedManager?.startsWith(`${fixture.packageManager}@`) ? fixture.packageManager : null;
  if (!manager || manager !== fixture.packageManager) return null;
  const packageVersion = versionedManager === 'npm' ? '10.9.2' : versionedManager!.slice(manager.length + 1);
  const expected = buildVerificationWorkspaceCommands(fixture.id, new Map([
    ['package.json', JSON.stringify({ packageManager: `${manager}@${packageVersion}` })],
    [manager === 'pnpm' ? 'pnpm-lock.yaml' : manager === 'npm' ? 'package-lock.json' : 'yarn.lock', ''],
  ]));
  return expected.commands;
}
function base(patch: CandidatePatch, fixture: VerificationFixture, workspace: string, status: VerificationReport['status'], steps: VerificationReport['steps'], limits: VerificationLimits, warnings: string[], summary={buildPassed:false,typecheckPassed:false,testPassed:false}): VerificationReport { return {verificationId:`verification-${randomUUID()}`,patchId:patch.patchId,fixtureId:fixture.id,status,workspace,steps,summary:{...summary,statement:status==='VERIFICATION_PASSED'?'The patched fixture passed configured isolated checks.':'The configured isolated checks did not all pass.'},environment:{runtime:'FakeSandbox-or-opt-in-Docker',node:process.version,lifecycleScriptsEnabled:false,inheritedEnvironment:['PATH','CI','NODE_ENV']},networkPolicy:{mode:'NETWORK_DISABLED',enforced:true},resourceLimits:limits,artifacts:[],warnings,requiresHumanReview:true}; }
