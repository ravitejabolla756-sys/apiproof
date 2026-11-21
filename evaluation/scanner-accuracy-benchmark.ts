import { CSharpRepositoryAnalyzer, GoRepositoryAnalyzer, JavaRepositoryAnalyzer, KotlinRepositoryAnalyzer, MultiLanguageRepositoryAnalyzer, PythonRepositoryAnalyzer, TypeScriptRepositoryAnalyzer, discoverProviders } from '@apiproof/analyzers';
import type { LanguageRepositoryAnalyzer } from '@apiproof/analyzers';
import { DISCOVERY_PROVIDER_REGISTRY } from '@apiproof/providers';
import type { ScanResult } from '@apiproof/shared';
import { SCANNER_ACCURACY_CASES, SCANNER_ACCURACY_ECOSYSTEMS, type ScannerBenchmarkCase, type ScannerBenchmarkCaseKind, type ScannerBenchmarkEcosystem } from './scanner-accuracy-fixtures.js';

export const SCANNER_ACCURACY_THRESHOLDS = {
  minimumCasesPerEcosystem: 4,
  overall: { precision: 0.95, recall: 0.95, versionAccuracy: 1 },
  perEcosystem: { precision: 0.95, recall: 0.95, versionAccuracy: 1 },
} as const;

export type ScannerBenchmarkOutcome = {
  readonly id: string;
  readonly ecosystem: ScannerBenchmarkEcosystem;
  readonly kind: ScannerBenchmarkCaseKind;
  readonly expected: ScannerBenchmarkCase['groundTruth'];
  readonly actual: {
    readonly providerId: string;
    readonly ecosystem: string;
    readonly packageName: string | null;
    readonly version: string | null;
    readonly providerUsed: boolean;
    readonly coverageComplete: boolean;
  };
};

export type ScannerBenchmarkMetrics = {
  readonly totalCases: number;
  readonly truePositives: number;
  readonly trueNegatives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly f1: number | null;
  readonly versionCases: number;
  readonly versionMatches: number;
  readonly versionAccuracy: number | null;
  readonly packageCases: number;
  readonly packageMatches: number;
  readonly packageAccuracy: number | null;
  readonly falsePositiveCaseIds: string[];
  readonly falseNegativeCaseIds: string[];
  readonly versionMismatchCaseIds: string[];
  readonly packageMismatchCaseIds: string[];
};

export type ScannerAccuracyReport = {
  readonly benchmark: 'scanner-accuracy-v1';
  readonly scope: {
    readonly ecosystems: readonly ScannerBenchmarkEcosystem[];
    readonly caseKinds: readonly ScannerBenchmarkCaseKind[];
    readonly fixtureCount: number;
    readonly onlineAccessRequired: false;
  };
  readonly thresholds: typeof SCANNER_ACCURACY_THRESHOLDS;
  readonly overall: ScannerBenchmarkMetrics;
  readonly perEcosystem: Record<ScannerBenchmarkEcosystem, ScannerBenchmarkMetrics>;
  readonly outcomes: readonly ScannerBenchmarkOutcome[];
  readonly passed: boolean;
  readonly limitations: readonly string[];
};

const ratio = (numerator: number, denominator: number): number | null => denominator === 0 ? null : numerator / denominator;

function metrics(outcomes: readonly ScannerBenchmarkOutcome[]): ScannerBenchmarkMetrics {
  const truePositives = outcomes.filter((item) => item.expected.providerUsed && item.actual.providerUsed).length;
  const trueNegatives = outcomes.filter((item) => !item.expected.providerUsed && !item.actual.providerUsed).length;
  const falsePositives = outcomes.filter((item) => !item.expected.providerUsed && item.actual.providerUsed).length;
  const falseNegatives = outcomes.filter((item) => item.expected.providerUsed && !item.actual.providerUsed).length;
  const versionCases = outcomes.filter((item) => item.expected.version !== null);
  const versionMatches = versionCases.filter((item) => item.actual.version === item.expected.version && item.actual.packageName === item.expected.packageName).length;
  const packageCases = outcomes.filter((item) => item.expected.packageName !== null);
  const packageMatches = packageCases.filter((item) => item.actual.packageName === item.expected.packageName).length;
  const precision = ratio(truePositives, truePositives + falsePositives);
  const recall = ratio(truePositives, truePositives + falseNegatives);
  return {
    totalCases: outcomes.length, truePositives, trueNegatives, falsePositives, falseNegatives,
    precision, recall, f1: precision === null || recall === null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall),
    versionCases: versionCases.length, versionMatches, versionAccuracy: ratio(versionMatches, versionCases.length),
    packageCases: packageCases.length, packageMatches, packageAccuracy: ratio(packageMatches, packageCases.length),
    falsePositiveCaseIds: outcomes.filter((item) => !item.expected.providerUsed && item.actual.providerUsed).map((item) => item.id).sort(),
    falseNegativeCaseIds: outcomes.filter((item) => item.expected.providerUsed && !item.actual.providerUsed).map((item) => item.id).sort(),
    versionMismatchCaseIds: versionCases.filter((item) => item.actual.version !== item.expected.version || item.actual.packageName !== item.expected.packageName).map((item) => item.id).sort(),
    packageMismatchCaseIds: packageCases.filter((item) => item.actual.packageName !== item.expected.packageName).map((item) => item.id).sort(),
  };
}

function meetsThresholds(value: ScannerBenchmarkMetrics, threshold: typeof SCANNER_ACCURACY_THRESHOLDS.overall): boolean {
  return value.precision !== null && value.precision >= threshold.precision
    && value.recall !== null && value.recall >= threshold.recall
    && value.versionAccuracy !== null && value.versionAccuracy >= threshold.versionAccuracy;
}

const SUPPORTED_ANALYZER = new MultiLanguageRepositoryAnalyzer([
  new TypeScriptRepositoryAnalyzer(), new PythonRepositoryAnalyzer(), new GoRepositoryAnalyzer(),
  new JavaRepositoryAnalyzer(), new KotlinRepositoryAnalyzer(), new CSharpRepositoryAnalyzer(),
]);

function analyzerFor(ecosystem: ScannerBenchmarkEcosystem): LanguageRepositoryAnalyzer {
  return SUPPORTED_ANALYZER.adapter(ecosystem);
}

async function runCase(item: ScannerBenchmarkCase): Promise<ScannerBenchmarkOutcome> {
  const adapter = analyzerFor(item.ecosystem);
  const files = new Map(Object.entries(item.files));
  const scan: ScanResult = await adapter.analyze(files, item.provider);
  const dependency = item.groundTruth.packageName === null
    ? undefined
    : scan.dependencies.find((candidate) => candidate.packageName === item.groundTruth.packageName);
  const discovery = item.ecosystem === 'typescript'
    ? discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY).find((candidate) => candidate.providerId === item.provider.id)
    : undefined;
  return {
    id: item.id, ecosystem: item.ecosystem, kind: item.kind, expected: item.groundTruth,
    actual: {
      providerId: scan.provider, ecosystem: scan.language, packageName: dependency?.packageName ?? discovery?.packageName ?? null,
      version: dependency?.versionResolution?.version ?? dependency?.lockedVersion ?? dependency?.installedVersion ?? discovery?.resolvedVersion ?? discovery?.detectedVersion ?? null,
      providerUsed: scan.providerUsed, coverageComplete: scan.coverage.complete,
    },
  };
}

export async function runScannerAccuracyBenchmark(cases: readonly ScannerBenchmarkCase[] = SCANNER_ACCURACY_CASES): Promise<ScannerAccuracyReport> {
  const orderedCases = cases.slice().sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const outcomes = [] as ScannerBenchmarkOutcome[];
  for (const item of orderedCases) outcomes.push(await runCase(item));
  const perEcosystem = Object.fromEntries(SCANNER_ACCURACY_ECOSYSTEMS.map((ecosystem) => [ecosystem, metrics(outcomes.filter((item) => item.ecosystem === ecosystem))])) as Record<ScannerBenchmarkEcosystem, ScannerBenchmarkMetrics>;
  const overall = metrics(outcomes);
  const passed = outcomes.length > 0
    && SCANNER_ACCURACY_ECOSYSTEMS.every((ecosystem) => perEcosystem[ecosystem].totalCases >= SCANNER_ACCURACY_THRESHOLDS.minimumCasesPerEcosystem && meetsThresholds(perEcosystem[ecosystem], SCANNER_ACCURACY_THRESHOLDS.perEcosystem))
    && meetsThresholds(overall, SCANNER_ACCURACY_THRESHOLDS.overall);
  return {
    benchmark: 'scanner-accuracy-v1',
    scope: { ecosystems: SCANNER_ACCURACY_ECOSYSTEMS, caseKinds: ['edge', 'malformed', 'negative', 'positive'], fixtureCount: outcomes.length, onlineAccessRequired: false },
    thresholds: SCANNER_ACCURACY_THRESHOLDS, overall, perEcosystem, outcomes, passed,
    limitations: [
      'This is a curated in-memory benchmark for the six explicit MultiLanguageRepositoryAnalyzer adapters: TypeScript, Python, Go, Java, Kotlin, and C#.',
      'It measures deterministic static package/use detection and exact version evidence in supported manifests or lockfiles; it does not execute customer code or resolve a compiler, package manager, runtime, or network graph.',
      'Dynamic imports, generated code, arbitrary aliases, transitive-only dependencies, and provider SDKs without explicit language bindings are outside this benchmark.',
      'The corpus is a regression gate, not a statistically representative sample of all repositories; passing it is not a production recall guarantee.',
    ],
  };
}

export function renderScannerAccuracyReport(report: ScannerAccuracyReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
