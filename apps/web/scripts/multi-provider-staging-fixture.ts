import { runProductizationScan } from '@apiproof/analyzers';
import { DISCOVERY_PROVIDERS, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { ReviewedCompatibilityChange } from '@apiproof/shared';
import { boundedProductizationProjection } from '../src/lib/server/productization-persistence.js';
import { productizationFindings } from '../src/lib/server/productization-worker.js';
import { analyzerSource } from './provider-validation-factory.js';

export const ANTHROPIC_PARAMETER_AMBIGUOUS_CHANGE_ID = 'anthropic-opus-4-7-parameter-restrictions';

export interface MultiProviderFixtureReport {
  readonly fixtureFiles: readonly string[];
  readonly discoveredProviders: readonly string[];
  readonly expectedAffectedChangeIds: readonly string[];
  readonly expectedNeedsReviewChangeIds: readonly string[];
  readonly actualAffectedChangeIds: readonly string[];
  readonly actualNeedsReviewChangeIds: readonly string[];
  readonly actualFindingChangeIds: readonly string[];
  readonly proofChangeIds: readonly string[];
  readonly exactLocations: Readonly<Record<string, { file: string | null; line: number | null; severity: string | null }>>;
  readonly duplicateFindingIds: readonly string[];
  readonly providerInterference: boolean;
  readonly boundedProjectionValid: boolean;
  readonly findingsProjectionValid: boolean;
  readonly scanMetrics: {
    totalFiles: number;
    analyzedFiles: number;
    providerEvidenceNodes: number;
    normalizedUsages: number;
    reviewedChangesConsidered: number;
    findings: number;
  };
}

export interface MultiProviderStagingFixture {
  readonly files: ReadonlyMap<string, string>;
  readonly changes: readonly ReviewedCompatibilityChange[];
}

function providerFor(change: ReviewedCompatibilityChange) {
  const provider = DISCOVERY_PROVIDERS.find((item) => item.id === change.providerId);
  if (!provider) throw new Error(`MULTI_PROVIDER_FIXTURE_PROVIDER_MISSING:${change.providerId}`);
  return provider;
}

function ambiguousAnthropicSource(source: string): string {
  const replaced = source
    .replace(/temperature:\s*[0-9]+(?:\.[0-9]+)?\b/, 'temperature')
    .replace(/\{\s*(model:\s*["'][^"']+["']),\s*temperature\s*\}/, '{ temperature, $1 }');
  if (replaced === source || !replaced.includes('{ temperature, model:')) throw new Error('MULTI_PROVIDER_FIXTURE_ANTHROPIC_PARAMETER_PATTERN_MISSING');
  return replaced.replace(/^(import[^\n]+\n)/, '$1const temperature = Number(process.env.MY_OWL_AMBIGUOUS_TEMPERATURE ?? "1");\n');
}

/**
 * Builds one repository snapshot from the same source fixture generator used
 * by the provider factory. It is intentionally in-memory and never writes or
 * contacts GitHub.
 */
export function buildMultiProviderStagingFixture(): MultiProviderStagingFixture {
  const changes = [...PRODUCTION_COMPATIBILITY_REGISTRY.changes].sort((a, b) => a.changeId.localeCompare(b.changeId, 'en'));
  const dependencies: Record<string, string> = {};
  const files: Record<string, string> = {};
  for (const change of changes) {
    const generated = analyzerSource(providerFor(change), change);
    const manifest = JSON.parse(generated['package.json'] ?? '{}') as { dependencies?: Record<string, string> };
    Object.assign(dependencies, manifest.dependencies ?? {});
    const source = generated['src/provider-validation.ts'];
    if (!source) throw new Error(`MULTI_PROVIDER_FIXTURE_SOURCE_MISSING:${change.changeId}`);
    files[`src/provider-validation/${change.changeId}.ts`] = change.changeId === ANTHROPIC_PARAMETER_AMBIGUOUS_CHANGE_ID
      ? ambiguousAnthropicSource(source)
      : source;
  }
  files['package.json'] = JSON.stringify({ private: true, dependencies }, null, 2);
  return { files: new Map(Object.entries(files)), changes };
}

export async function runMultiProviderStagingFixture(): Promise<MultiProviderFixtureReport> {
  const fixture = buildMultiProviderStagingFixture();
  const scan = await runProductizationScan({
    repositoryId: 'multi-provider-staging-fixture',
    scanId: 'multi-provider-staging-fixture-scan',
    files: fixture.files,
  });
  const projection = boundedProductizationProjection(scan);
  const findings = productizationFindings(scan);
  const expectedAffected = fixture.changes.filter((change) => change.changeId !== ANTHROPIC_PARAMETER_AMBIGUOUS_CHANGE_ID).map((change) => change.changeId);
  const expectedNeedsReview = [ANTHROPIC_PARAMETER_AMBIGUOUS_CHANGE_ID];
  const results = new Map(scan.compatibilityResults.map((result) => [result.changeId, result]));
  const actualAffected = fixture.changes.filter((change) => results.get(change.changeId)?.status === 'AFFECTED').map((change) => change.changeId);
  const actualNeedsReview = fixture.changes.filter((change) => results.get(change.changeId)?.status === 'NEEDS_REVIEW').map((change) => change.changeId);
  const findingIds = findings.map((finding) => finding.id);
  const duplicateFindingIds = findingIds.filter((id, index) => findingIds.indexOf(id) !== index);
  const findingChangeIds = findings.map((finding) => finding.changeId);
  const providerInterference = findings.some((finding) => results.get(finding.changeId)?.providerId !== finding.provider);
  const exactLocations = Object.fromEntries(fixture.changes.map((change) => {
    const result = results.get(change.changeId);
    return [change.changeId, { file: result?.exactFile ?? null, line: result?.exactLine ?? null, severity: result?.severity ?? null }];
  }));
  const serializedProjection = JSON.stringify(projection);
  return {
    fixtureFiles: [...fixture.files.keys()].sort((a, b) => a.localeCompare(b, 'en')),
    discoveredProviders: scan.discoveries.map((item) => item.providerId).sort((a, b) => a.localeCompare(b, 'en')),
    expectedAffectedChangeIds: expectedAffected,
    expectedNeedsReviewChangeIds: expectedNeedsReview,
    actualAffectedChangeIds: actualAffected,
    actualNeedsReviewChangeIds: actualNeedsReview,
    actualFindingChangeIds: findingChangeIds,
    proofChangeIds: scan.proofs.map((proof) => proof.changeId).sort((a, b) => a.localeCompare(b, 'en')),
    exactLocations,
    duplicateFindingIds,
    providerInterference,
    boundedProjectionValid: projection.schemaVersion === 2 && Array.isArray(projection.compatibilityResults) && Array.isArray(projection.proofs)
      && !serializedProjection.includes('export async function validate'),
    findingsProjectionValid: findings.every((finding) => Boolean(finding.changeId && finding.provider && finding.filePath && finding.lineNumber && finding.reasonCodes.length)),
    scanMetrics: { ...scan.metrics },
  };
}
