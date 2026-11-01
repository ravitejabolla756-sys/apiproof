import { describe, expect, it } from 'vitest';
import { summarizeQualityBenchmark } from '@apiproof/providers';

describe('quality benchmark summary', () => {
  it('counts false positives separately from missed affected cases', () => {
    const report = summarizeQualityBenchmark([
      { providerId: 'openai', expected: 'AFFECTED', actual: 'AFFECTED' },
      { providerId: 'openai', expected: 'NOT_AFFECTED', actual: 'AFFECTED' },
      { providerId: 'openai', expected: 'NEEDS_REVIEW', actual: 'NEEDS_REVIEW' },
    ]);

    expect(report).toMatchObject({
      totalCases: 3,
      correctCases: 2,
      incorrectCases: 1,
      affectedDetected: 1,
      falsePositiveCases: 1,
      uncertainPreserved: 1,
      providersCovered: ['openai'],
    });
  });
});
