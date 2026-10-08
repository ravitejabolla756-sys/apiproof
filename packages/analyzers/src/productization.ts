import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityProof, NormalizedUsageIR, ScanResult, SupportedLanguage } from '@apiproof/shared';
import { DISCOVERY_PROVIDER_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { ProviderDefinition } from '@apiproof/providers';
import type { ProviderDescriptor } from '@apiproof/core';
import { literalHash } from '@apiproof/shared';
import { buildReviewedRuleCoverage } from '@apiproof/providers';
import { TypeScriptRepositoryAnalyzer } from './typescript/index.js';
import { discoverProviders, type ProviderDiscoveryResult } from './typescript/provider-discovery.js';
import { RepositorySnapshot } from './typescript/repository.js';
import { detectRepositoryLanguages } from './multi-language.js';
import { evaluateRegisteredNormalizedCompatibility } from './typescript/compatibility.js';
import { PythonRepositoryAnalyzer, type PythonProviderDescriptor } from './python/index.js';
import { normalizeCompatibilityUsage, usageFindingToCompatibilityUsage } from './typescript/usage-ir.js';
import { matchesProviderDomain } from './http-metadata.js';

export interface ProductizationPrivacyContract {
  externalAiRequired: false;
  rawSourceExternalTransmission: false;
  authoritativeDecision: 'deterministic-reviewed-registry';
}

export interface ProductizationScanResult {
  repositoryId: string;
  baselineSha: string;
  scanId: string;
  languages: ReturnType<typeof detectRepositoryLanguages>;
  discoveries: ProviderDiscoveryResult[];
  usageIR: NormalizedUsageIR[];
  compatibilityResults: ReturnType<typeof evaluateRegisteredNormalizedCompatibility>;
  proofs: CompatibilityProof[];
  coverage: ReturnType<typeof buildReviewedRuleCoverage>;
  timingsMs: { discovery: number; analysis: number; compatibility: number; proof: number; total: number };
  metrics: { totalFiles: number; analyzedFiles: number; providerEvidenceNodes: number; normalizedUsages: number; reviewedChangesConsidered: number; findings: number };
  privacy: ProductizationPrivacyContract;
}

function pythonProviderDefinitions(files: ReadonlyMap<string, string>, definitions: readonly ProviderDefinition[]): ProviderDefinition[] {
  const metadata = [...files].filter(([file]) => /(^|\/)(?:requirements(?:-[^/]+)?\.txt|pyproject\.toml|poetry\.lock|uv\.lock)$/.test(file)).map(([, content]) => content.toLowerCase()).join('\n');
  const source = [...files].filter(([file]) => /\.py$/i.test(file)).map(([, content]) => content).join('\n');
  const urls = [...source.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((match) => match[0]);
  return definitions.filter((definition) => definition.packageIdentifiers.some((name) => metadata.includes(name.toLowerCase()))
    || urls.some((url) => definition.apiDomains.some((domain) => matchesProviderDomain(url, [domain]))));
}

const descriptorFor = (discovery: ProviderDiscoveryResult) => ({
  id: discovery.providerId,
  packageName: discovery.packageName ?? discovery.evidence.find((item) => item.packageName)?.packageName ?? discovery.providerId,
  constructorExports: [] as readonly string[],
  apiDomains: discovery.apiDomains,
  apiVersionHeaders: discovery.apiVersionHeaders,
});

const normalizedVersionSource = (source: ProviderDiscoveryResult['versionSource']): NormalizedUsageIR['versionSource'] =>
  source === 'pnpm-lock' || source === 'package-lock' || source === 'yarn-lock' ? 'lockfile' : source;

function reviewedModelForUsage(usage: ScanResult['usages'][number], providerId: string): string | undefined {
  const modelProperties = usage.arguments?.flatMap((argument) => argument.properties.filter((property) => property.path === 'model')) ?? [];
  if (modelProperties.length === 0) return undefined;
  const candidates = PRODUCTION_COMPATIBILITY_REGISTRY.changes
    .filter((change) => change.providerId === providerId && change.applicabilityScope.dimensions.includes('model'))
    .flatMap((change) => [...change.affectedModels, ...(change.replacement?.model ? [change.replacement.model] : [])]);
  return candidates.find((candidate) => modelProperties.some((property) => property.literalHash === literalHash(candidate)));
}

/**
 * Production-shaped local scan path. It consumes only a repository snapshot,
 * never executes repository code, and never calls an external AI service.
 */
export async function runProductizationScan(input: {
  repositoryId: string;
  baselineSha?: string;
  scanId: string;
  files: ReadonlyMap<string, string> | Record<string, string>;
}): Promise<ProductizationScanResult> {
  const started = Date.now();
  const files = input.files instanceof Map ? input.files : new Map(Object.entries(input.files));
  const snapshot = RepositorySnapshot.fromMemory(`/repositories/${input.repositoryId}`, new Map(files));
  const languages = detectRepositoryLanguages(files);
  const discoveryStarted = Date.now();
  const discoveries = discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY);
  const pythonDefinitions = pythonProviderDefinitions(files, DISCOVERY_PROVIDER_REGISTRY.definitions);
  const allProviderIds = [...new Set([
    ...discoveries.map((discovery) => discovery.providerId),
    ...pythonDefinitions.map((definition) => definition.id),
  ])].sort();
  const discoveryMs = Date.now() - discoveryStarted;
  const analyzer = new TypeScriptRepositoryAnalyzer();
  const pythonAnalyzer = new PythonRepositoryAnalyzer();
  const analysisStarted = Date.now();
  const scans: ScanResult[] = [];
  // Discovery metadata is intentionally independent of compatibility
  // capability; the reviewed registry is the sole compatibility gate.
  for (const discovery of discoveries) {
    scans.push(await analyzer.analyze(snapshot, descriptorFor(discovery)));
  }
  for (const definition of pythonDefinitions) {
    scans.push(await pythonAnalyzer.analyze(files, {
      id: definition.id,
      packageName: definition.packageIdentifiers[0] ?? definition.id,
      packageNames: definition.packageIdentifiers,
      constructorExports: [],
      apiDomains: definition.apiDomains,
      ...(definition.apiVersionHeaders ? { apiVersionHeaders: definition.apiVersionHeaders } : {}),
      environmentVariables: definition.environmentVariables,
    } satisfies PythonProviderDescriptor as ProviderDescriptor));
  }
  const usageIR = scans.flatMap((scan) => {
    const discovery = discoveries.find((item) => item.providerId === scan.provider);
    return scan.usages.map((finding) => {
      const base = usageFindingToCompatibilityUsage(finding, discovery?.packageName ?? scan.provider);
      const reviewedModel = reviewedModelForUsage(finding, scan.provider);
      const normalized = normalizeCompatibilityUsage(reviewedModel ? { ...base, model: reviewedModel } : base, { language: scan.language as 'typescript' | 'python' });
      return {
        ...normalized,
        declaredVersion: discovery?.declaredVersion ?? normalized.declaredVersion,
        resolvedVersion: discovery?.resolvedVersion ?? normalized.resolvedVersion,
        versionSource: discovery ? normalizedVersionSource(discovery.versionSource) : normalized.versionSource,
        versionConfidence: discovery?.versionConfidence ?? normalized.versionConfidence,
      };
    });
  });
  const analysisMs = Date.now() - analysisStarted;
  const compatibilityStarted = Date.now();
  const compatibilityResults = allProviderIds.flatMap((providerId) => evaluateRegisteredNormalizedCompatibility({
    providerId,
    usageIR: usageIR.filter((usage) => usage.providerId === providerId),
    completeEvidence: scans.every((scan) => scan.coverage.complete),
  }, PRODUCTION_COMPATIBILITY_REGISTRY));
  const compatibilityMs = Date.now() - compatibilityStarted;
  const proofStarted = Date.now();
  const baselineSha = input.baselineSha ?? snapshot.digest();
  const proofs = buildCompatibilityProofSnapshot({
    repositoryId: input.repositoryId,
    baselineSha,
    scanId: input.scanId,
    results: compatibilityResults,
    mode: 'production',
  });
  const proofMs = Date.now() - proofStarted;
  return {
    repositoryId: input.repositoryId,
    baselineSha,
    scanId: input.scanId,
    languages,
    discoveries,
    usageIR,
    compatibilityResults,
    proofs,
    coverage: buildReviewedRuleCoverage(PRODUCTION_COMPATIBILITY_REGISTRY),
    timingsMs: { discovery: discoveryMs, analysis: analysisMs, compatibility: compatibilityMs, proof: proofMs, total: Date.now() - started },
    metrics: {
      totalFiles: files.size,
      analyzedFiles: scans.reduce((total, scan) => total + scan.coverage.filesAnalyzed, 0),
      providerEvidenceNodes: discoveries.reduce((total, item) => total + item.evidence.length, 0),
      normalizedUsages: usageIR.length,
      reviewedChangesConsidered: PRODUCTION_COMPATIBILITY_REGISTRY.changes.length,
      findings: proofs.length,
    },
    privacy: { externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' },
  };
}

export type ProductizationLanguage = SupportedLanguage;
