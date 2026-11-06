import { describe, expect, it } from 'vitest';
import { renderScannerAccuracyReport, runScannerAccuracyBenchmark } from '../evaluation/scanner-accuracy-benchmark.js';

describe('scanner accuracy benchmark', () => {
  it('passes deterministic precision/recall/version gates for every supported ecosystem', async () => {
    const report = await runScannerAccuracyBenchmark();

    expect(report.passed).toBe(true);
    expect(report.scope.ecosystems).toEqual(['csharp', 'go', 'java', 'kotlin', 'python', 'typescript']);
    expect(report.scope.fixtureCount).toBe(24);
    expect(report.overall).toMatchObject({ totalCases: 24, truePositives: 18, trueNegatives: 6, falsePositives: 0, falseNegatives: 0, precision: 1, recall: 1, versionCases: 18, versionMatches: 18, versionAccuracy: 1, packageCases: 18, packageMatches: 18, packageAccuracy: 1 });
    expect(report.outcomes.filter((item) => item.kind === 'malformed')).toHaveLength(6);
    expect(report.outcomes.filter((item) => item.actual.ecosystem !== item.ecosystem)).toEqual([]);
    expect(Object.values(report.perEcosystem).every((item) => item.precision === 1 && item.recall === 1 && item.versionAccuracy === 1)).toBe(true);
  });

  it('renders byte-for-byte stable output without credentials or network access', async () => {
    const first = await runScannerAccuracyBenchmark();
    const second = await runScannerAccuracyBenchmark();
    expect(renderScannerAccuracyReport(first)).toBe(renderScannerAccuracyReport(second));
  });
});
