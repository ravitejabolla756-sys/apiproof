import { runProviderValidationFactory, validationReportMarkdown } from './provider-validation-factory.js';

const report = await runProviderValidationFactory();
const markdown = process.argv.includes('--markdown');

process.stdout.write(markdown ? validationReportMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`);
if (report.counts.enginePasses !== report.counts.engineCases) process.exitCode = 1;
