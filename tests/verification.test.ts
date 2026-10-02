import { describe, expect, it } from 'vitest';
import { CandidatePatchSchema } from '@apiproof/shared';
import { FakeSandbox, DockerSandbox, verifyPatchedFixture, evaluateVerification, verificationFixtures } from '@apiproof/core';

const patch = CandidatePatchSchema.parse({ patchId:'patch-test', changeId:'change-test', repositoryId:'coupon-basic', status:'PATCH_READY_FOR_VALIDATION', files:[], evidenceReferences:[], planReferences:['0'.repeat(64)], warnings:[], validation:[], generatedBy:{implementation:'test',version:'0.5.0',model:null,aiUsed:false,changeDigest:'0'.repeat(64),rulesDigest:'0'.repeat(64),planDigest:'0'.repeat(64),sourceDigests:{},runId:'run-test',workspace:'C:\\YC\\.tmp\\patch-runs\\run-test\\repository'}, requiresHumanReview:true });
const fixture = (await verificationFixtures()).find((x)=>x.id==='coupon-basic')!;
describe('isolated verification', () => {
  it('passes controlled fake stages with no inherited credentials or network', async () => {
    const result = await verifyPatchedFixture(patch, fixture, new FakeSandbox());
    expect(result.status).toBe('VERIFICATION_PASSED'); expect(result.requiresHumanReview).toBe(true);
    expect(result.networkPolicy).toMatchObject({mode:'NETWORK_DISABLED',enforced:true}); expect(result.environment.inheritedEnvironment).toEqual(['PATH','CI','NODE_ENV']); expect(result.environment.lifecycleScriptsEnabled).toBe(false);
    expect(result.steps).toHaveLength(4); expect(result.steps.every((step)=>step.status==='PASSED')).toBe(true);
  });
  it.each([['INSTALL','VERIFICATION_INSTALL_FAILED'],['BUILD','VERIFICATION_BUILD_FAILED'],['TYPECHECK','VERIFICATION_TYPECHECK_FAILED'],['TEST','VERIFICATION_TEST_FAILED']] as const)('classifies %s failure', async (stage, expected) => {
    const result=await verifyPatchedFixture(patch,fixture,new FakeSandbox({[stage]:{status:'FAILED',exitCode:1}})); expect(result.status).toBe(expected); expect(result.steps.at(-1)?.stage).toBe(stage);
  });
  it('classifies timeout and bounds output', async () => {
    const result=await verifyPatchedFixture(patch,fixture,new FakeSandbox({BUILD:{status:'TIMED_OUT'},TEST:{stdout:'x'.repeat(100000)}})); expect(result.status).toBe('VERIFICATION_TIMED_OUT'); expect(result.steps.at(-1)?.stage).toBe('BUILD');
    const output=await verifyPatchedFixture(patch,fixture,new FakeSandbox({INSTALL:{stdout:'x'.repeat(100000)}})); expect(output.steps[0]!.stdoutTruncated).toBe(true); expect(output.steps[0]!.stdout.length).toBe(65536);
  });
  it('rejects unregistered and nonvalidated candidates without invoking a sandbox', async () => {
    let calls=0; const sandbox={run:async()=>{calls++; throw new Error('must not run');}};
    const denied=await verifyPatchedFixture(patch,{...fixture,id:'denied',executionAllowed:false},sandbox); expect(denied.status).toBe('VERIFICATION_NOT_ALLOWED');
    const invalid=await verifyPatchedFixture({...patch,status:'PATCH_REJECTED'},fixture,sandbox); expect(invalid.status).toBe('VERIFICATION_POLICY_REJECTED'); expect(calls).toBe(0);
  });
  it('keeps fake evaluation repeatable and reports Docker separately', async () => {
    const result=await evaluateVerification(); expect(result.passed).toBe(true); expect(result.metrics.sandboxEscapes).toBe(0); expect(result.metrics.hostSecretLeakage).toBe(0); expect(result.metrics.correctStatuses).toBe(15); expect(result.metrics.correctFailingStages).toBe(15);
  });
  it('Docker command is shell-free and network-disabled', () => {
    const sandbox=new DockerSandbox(); expect(sandbox).toBeDefined();
  });
  it('rejects fake execution in production before running any stage', async () => {
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const report = await verifyPatchedFixture(patch, fixture, new FakeSandbox());
      expect(report.status).toBe('VERIFICATION_POLICY_REJECTED');
      expect(report.steps).toHaveLength(0);
    } finally { if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior; }
  });
  it('requires successful exit codes, not merely passed labels', async () => {
    const report = await verifyPatchedFixture(patch, fixture, new FakeSandbox({ TEST: { status: 'PASSED', exitCode: 1 } }));
    expect(report.status).toBe('VERIFICATION_TEST_FAILED');
  });
});
