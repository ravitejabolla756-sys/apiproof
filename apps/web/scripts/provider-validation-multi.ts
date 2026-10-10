import { runMultiProviderStagingFixture } from './multi-provider-staging-fixture.js';

const report = await runMultiProviderStagingFixture();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.boundedProjectionValid || !report.findingsProjectionValid || report.providerInterference
  || report.actualAffectedChangeIds.length !== 19 || report.actualNeedsReviewChangeIds.length !== 1) process.exitCode = 1;
