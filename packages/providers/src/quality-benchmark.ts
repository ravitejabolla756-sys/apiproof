export type QualityBenchmarkExpected = 'AFFECTED' | 'NOT_AFFECTED' | 'NEEDS_REVIEW';

export type QualityBenchmarkCase = {
  providerId: string;
  expected: QualityBenchmarkExpected;
  actual: QualityBenchmarkExpected;
};

export type QualityBenchmarkReport = {
  totalCases: number;
  correctCases: number;
  incorrectCases: number;
  accuracy: number;
  affectedCases: number;
  affectedDetected: number;
  unaffectedCases: number;
  falsePositiveCases: number;
  uncertainCases: number;
  uncertainPreserved: number;
  providersCovered: string[];
};

/**
 * Summarizes a deterministic fixture benchmark. This is deliberately generic
 * so callers can report offline analyzer evidence without coupling the
 * providers package to a test runner or to a particular analyzer implementation.
 */
export function summarizeQualityBenchmark(cases: readonly QualityBenchmarkCase[]): QualityBenchmarkReport {
  const correctCases = cases.filter((item) => item.expected === item.actual).length;
  const affectedCases = cases.filter((item) => item.expected === 'AFFECTED');
  const unaffectedCases = cases.filter((item) => item.expected === 'NOT_AFFECTED');
  const uncertainCases = cases.filter((item) => item.expected === 'NEEDS_REVIEW');

  return {
    totalCases: cases.length,
    correctCases,
    incorrectCases: cases.length - correctCases,
    accuracy: cases.length === 0 ? 0 : correctCases / cases.length,
    affectedCases: affectedCases.length,
    affectedDetected: affectedCases.filter((item) => item.actual === 'AFFECTED').length,
    unaffectedCases: unaffectedCases.length,
    falsePositiveCases: unaffectedCases.filter((item) => item.actual === 'AFFECTED').length,
    uncertainCases: uncertainCases.length,
    uncertainPreserved: uncertainCases.filter((item) => item.actual === 'NEEDS_REVIEW').length,
    providersCovered: [...new Set(cases.map((item) => item.providerId))].sort(),
  };
}
