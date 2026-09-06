import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { it, expect } from 'vitest';
import { CandidatePatchSchema } from '@apiproof/shared';
import { root } from './helpers.js';

const execute = promisify(execFile);
const cli = (args: string[]) => execute(process.execPath, ['--import', 'tsx', '--conditions=apiproof-source', 'apps/cli/src/index.ts', ...args], { cwd: root, windowsHide: true, timeout: 20_000, maxBuffer: 2_000_000 });
const fixture = path.join(root, 'evaluation-patches/corpus/coupon-basic');
it('source CLI emits a schema-valid patch and human review output', async () => {
  const args = ['patch', fixture, '--change-id', 'stripe-subscription-coupon-removed'];
  const result = CandidatePatchSchema.parse(JSON.parse((await cli([...args, '--json'])).stdout));
  expect(result.status).toBe('PATCH_READY_FOR_VALIDATION');
  expect((await cli(args)).stdout).toContain('NOT EXECUTED. NOT VERIFIED. NOT COMMITTED.');
});
it.each([['patch', root, '--change-id', 'stripe-subscription-coupon-removed', '--json'], ['patch', path.join(root, 'evaluation-plans/corpus/coupon-direct'), '--change-id', 'stripe-subscription-coupon-removed', '--json']])('CLI refuses arbitrary patch target %j', async (...args) => {
  await expect(cli(args)).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('FIXTURE_ONLY') });
});
it.each(['patch', 'evaluate-patches'])('CLI refuses unconfigured model for %s', async (command) => {
  const args = command === 'patch' ? [command, fixture, '--change-id', 'stripe-subscription-coupon-removed', '--with-model', '--json'] : [command, '--with-model', '--json'];
  await expect(cli(args)).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('MODEL_UNAVAILABLE') });
});
it('CLI rejects caller supplied fixture and registry roots', async () => {
  await expect(cli(['evaluate-patches', '--corpus', root, '--json'])).rejects.toMatchObject({ code: 2, stdout: expect.stringContaining('INVALID_ARGUMENTS') });
});
