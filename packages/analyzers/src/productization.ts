import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityProof, NormalizedUsageIR, ScanResult, SupportedLanguage } from '@apiproof/shared';
import { DISCOVERY_PROVIDER_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { ProductionChangeRegistry, ProviderDefinition } from '@apiproof/providers';
import type { ProviderDescriptor } from '@apiproof/core';
import { literalHash } from '@apiproof/shared';
import { buildReviewedRuleCoverage } from '@apiproof/providers';
import { TypeScriptRepositoryAnalyzer } from './typescript/index.js';
import { discoverProviders, type ProviderDiscoveryResult } from './typescript/provider-discovery.js';
import { RepositorySnapshot } from './typescript/repository.js';
import { detectRepositoryLanguages, MultiLanguageRepositoryAnalyzer } from './multi-language.js';
import { evaluateRegisteredNormalizedCompatibility } from './typescript/compatibility.js';
import { PythonRepositoryAnalyzer, type PythonProviderDescriptor } from './python/index.js';
import type { GoProviderDescriptor } from './go/index.js';
import type { JvmProviderDescriptor } from './jvm/index.js';
import type { DotnetProviderDescriptor } from './dotnet/index.js';
import { normalizeCompatibilityUsage, usageFindingToCompatibilityUsage } from './typescript/usage-ir.js';

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
  return definitions.filter((definition) => definition.packageIdentifiers.some((name) => metadata.includes(name.toLowerCase())));
}

type ProductizationAdapterLanguage = 'go' | 'java' | 'kotlin' | 'csharp';

const PRODUCTIZATION_LANGUAGES = new Set<SupportedLanguage>(['typescript', 'javascript', 'python', 'go', 'java', 'kotlin', 'csharp']);

type LanguageProviderDescriptor = GoProviderDescriptor | JvmProviderDescriptor | DotnetProviderDescriptor;

/**
 * Discovery registry package identifiers are JavaScript-oriented. They must
 * not be reused as Go modules, Maven coordinates, or NuGet namespaces. Add a
 * language binding here only when the provider's official SDK coordinate is
 * explicitly verified; otherwise domain and environment evidence remains
 * available without manufacturing package evidence.
 */
const VERIFIED_LANGUAGE_PACKAGE_BINDINGS: Readonly<Record<string, {
  go?: readonly string[];
  jvm?: readonly string[];
  dotnet?: readonly string[];
}>> = {};

function languageProviderDescriptor(definition: ProviderDefinition, language: ProductizationAdapterLanguage): LanguageProviderDescriptor {
  const binding = VERIFIED_LANGUAGE_PACKAGE_BINDINGS[definition.id];
  const packageNames = [...new Set(language === 'go' ? (binding?.go ?? []) : language === 'csharp' ? (binding?.dotnet ?? []) : (binding?.jvm ?? []))];
  const base = {
    id: definition.id,
    packageName: packageNames[0] ?? `__unbound__:${definition.id}`,
    constructorExports: [] as readonly string[],
    apiDomains: definition.apiDomains,
    environmentVariables: definition.environmentVariables,
  };
  if (language === 'go') return { ...base, packageNames } satisfies GoProviderDescriptor;
  if (language === 'java' || language === 'kotlin') return { ...base, packageNames, coordinates: packageNames } satisfies JvmProviderDescriptor;
  return { ...base, packageNames, namespaceNames: packageNames } satisfies DotnetProviderDescriptor;
}

const descriptorFor = (discovery: ProviderDiscoveryResult) => ({
  id: discovery.providerId,
  packageName: discovery.packageName ?? discovery.evidence.find((item) => item.packageName)?.packageName ?? discovery.providerId,
  constructorExports: discovery.constructorExports,
});

const normalizedVersionSource = (source: ProviderDiscoveryResult['versionSource']): NormalizedUsageIR['versionSource'] =>
  source === 'pnpm-lock' || source === 'package-lock' || source === 'yarn-lock' ? 'lockfile' : source;

function reviewedModelForUsage(usage: ScanResult['usages'][number], providerId: string, registry: ProductionChangeRegistry): string | undefined {
  const modelProperties = usage.arguments?.flatMap((argument) => argument.properties.filter((property) => property.path === 'model')) ?? [];
  if (modelProperties.length === 0) return undefined;
  const candidates = registry.changes
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
  registry?: ProductionChangeRegistry;
}): Promise<ProductizationScanResult> {
  const started = Date.now();
  const files = input.files instanceof Map ? input.files : new Map(Object.entries(input.files));
  const registry = input.registry ?? PRODUCTION_COMPATIBILITY_REGISTRY;
  const snapshot = RepositorySnapshot.fromMemory(`/repositories/${input.repositoryId}`, new Map(files));
  const languages = detectRepositoryLanguages(files);
  const discoveryStarted = Date.now();
  const discoveries = discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY);
  const pythonDefinitions = pythonProviderDefinitions(files, DISCOVERY_PROVIDER_REGISTRY.definitions);
  const discoveryMs = Date.now() - discoveryStarted;
  const analyzer = new TypeScriptRepositoryAnalyzer();
  const pythonAnalyzer = new PythonRepositoryAnalyzer();
  const multiLanguageAnalyzer = new MultiLanguageRepositoryAnalyzer();
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
      environmentVariables: definition.environmentVariables,
    } satisfies PythonProviderDescriptor as ProviderDescriptor));
  }
  // The language-neutral adapters are part of the productization path, not
  // merely standalone library exports. Run them only for languages explicitly
  // evidenced by repository filenames, and retain only provider-used scans so
  // compatibility evaluation stays bounded and evidence-driven.
  for (const languageEvidence of languages) {
    if (languageEvidence.language === 'typescript' || languageEvidence.language === 'javascript' || languageEvidence.language === 'python') continue;
    if (languageEvidence.language !== 'go' && languageEvidence.language !== 'java' && languageEvidence.language !== 'kotlin' && languageEvidence.language !== 'csharp') continue;
    for (const definition of DISCOVERY_PROVIDER_REGISTRY.definitions) {
      const scan = await multiLanguageAnalyzer.analyzeLanguage(
        languageEvidence.language,
        files,
        languageProviderDescriptor(definition, languageEvidence.language),
      );
      if (scan.providerUsed) scans.push(scan);
    }
  }
  const usageIR = scans.flatMap((scan) => {
    const discovery = discoveries.find((item) => item.providerId === scan.provider);
    const dependency = scan.dependencies[0];
    const declaredVersion = dependency?.declarations[0]?.range ?? null;
    const resolvedVersion = dependency?.versionResolution?.version ?? null;
    const versionSource = dependency?.versionResolution?.source ?? 'unknown';
    const versionConfidence = resolvedVersion ? 'exact' : declaredVersion ? 'declared-only' : 'unknown';
    return scan.usages.map((finding) => {
      const base = usageFindingToCompatibilityUsage(finding, dependency?.packageName ?? discovery?.packageName ?? scan.provider);
      const reviewedModel = reviewedModelForUsage(finding, scan.provider, registry);
      const normalized = normalizeCompatibilityUsage(reviewedModel ? { ...base, model: reviewedModel } : base, {
        language: scan.language as 'typescript' | 'python' | 'go' | 'java' | 'kotlin' | 'csharp',
        declaredVersion,
        resolvedVersion,
        versionSource,
        versionConfidence,
      });
      return {
        ...normalized,
        declaredVersion: discovery?.declaredVersion ?? normalized.declaredVersion,
        resolvedVersion: discovery?.resolvedVersion ?? normalized.resolvedVersion,
        versionSource: discovery ? normalizedVersionSource(discovery.versionSource) : normalized.versionSource,
        versionConfidence: discovery?.versionConfidence ?? normalized.versionConfidence,
      };
    });
  }).filter((usage, index, values) => values.findIndex((candidate) => `${candidate.language}:${candidate.id}` === `${usage.language}:${usage.id}`) === index)
    .sort((left, right) => `${left.language}:${left.id}`.localeCompare(`${right.language}:${right.id}`, 'en'));
  const allProviderIds = [...new Set(scans.filter((scan) => scan.providerUsed).map((scan) => scan.provider))].sort();
  const completeEvidence = languages.every((language) => PRODUCTIZATION_LANGUAGES.has(language.language)) && scans.every((scan) => scan.coverage.complete);
  const analysisMs = Date.now() - analysisStarted;
  const compatibilityStarted = Date.now();
  const compatibilityResults = allProviderIds.flatMap((providerId) => evaluateRegisteredNormalizedCompatibility({
    providerId,
    usageIR: usageIR.filter((usage) => usage.providerId === providerId),
    completeEvidence,
  }, registry));
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
    coverage: buildReviewedRuleCoverage(registry),
    timingsMs: { discovery: discoveryMs, analysis: analysisMs, compatibility: compatibilityMs, proof: proofMs, total: Date.now() - started },
    metrics: {
      totalFiles: files.size,
      analyzedFiles: scans.reduce((total, scan) => total + scan.coverage.filesAnalyzed, 0),
      providerEvidenceNodes: discoveries.reduce((total, item) => total + item.evidence.length, 0),
      normalizedUsages: usageIR.length,
      reviewedChangesConsidered: registry.changes.length,
      findings: proofs.length,
    },
    privacy: { externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' },
  };
}

export type ProductizationLanguage = SupportedLanguage;
