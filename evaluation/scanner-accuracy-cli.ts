import { renderScannerAccuracyReport, runScannerAccuracyBenchmark } from './scanner-accuracy-benchmark.js';

const report = await runScannerAccuracyBenchmark();
process.stdout.write(renderScannerAccuracyReport(report));
if (!report.passed) process.exitCode = 1;
