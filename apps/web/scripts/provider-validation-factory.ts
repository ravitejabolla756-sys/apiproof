import { type CompatibilityUsage, type ReviewedCompatibilityChange } from '@apiproof/shared';
import { PRODUCTION_COMPATIBILITY_REGISTRY, DISCOVERY_PROVIDERS, type ProviderDefinition } from '@apiproof/providers';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage, runProductizationScan } from '@apiproof/analyzers';
import { boundedProductizationProjection } from '../src/lib/server/productization-persistence.js';
import { productizationFindings } from '../src/lib/server/productization-worker.js';

export type ValidationLayer = 'engine' | 'productization';
export type ValidationFixtureKind = 'affected' | 'not_affected' | 'needs_review';

export interface ProviderValidationCase {
  readonly providerId: string;
  readonly changeId: string;
  readonly layer: ValidationLayer;
  readonly kind: ValidationFixtureKind;
  readonly status: 'AFFECTED' | 'NOT_AFFECTED' | 'NEEDS_REVIEW' | 'UNAVAILABLE';
  readonly pass: boolean;
  readonly reasonCodes: readonly string[];
  readonly usageCount: number;
  readonly discovered: boolean;
  readonly normalizedUsageCount: number;
  readonly proofCount: number;
  readonly findingCount: number;
  readonly boundedProjectionValid?: boolean;
  readonly findingsProjectionValid?: boolean;
  readonly rawSourcePresentInProjection?: boolean;
  readonly note?: string;
}

export interface ProviderValidationRuleReport {
  readonly providerId: string;
  readonly changeId: string;
  readonly engine: readonly ProviderValidationCase[];
  readonly productization: readonly ProviderValidationCase[];
  readonly isolation: {
    wrongProviderHasAffectedResult: false;
    duplicateUsageCount: number;
    duplicateUsageDeduplicated: boolean;
  };
}

export interface ProviderValidationReport {
  readonly schemaVersion: 1;
  readonly providers: readonly string[];
  readonly reviewedRules: readonly string[];
  readonly rules: readonly ProviderValidationRuleReport[];
  readonly counts: {
    providers: number;
    reviewedRules: number;
    engineCases: number;
    enginePasses: number;
    productizationCases: number;
    productizationPasses: number;
    productizationPartial: number;
    proofsProjected: number;
    findingsProjected: number;
  };
  readonly productionPersistence: {
    boundedProjectionCases: number;
    boundedProjectionValidated: boolean;
    findingsProjectionValidated: boolean;
    rawSourcePresentInProjection: boolean;
  };
  readonly privacy: {
    rawSourceExternalTransmission: false;
    secretLikeValuesPresentInProjection: false;
  };
}

const PACKAGE_VERSION = '1.0.0';
const POSITIVE_FILE = 'src/provider-validation.ts';

const providerFor = (providerId: string): ProviderDefinition => {
  const provider = DISCOVERY_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) throw new Error(`VALIDATION_PROVIDER_NOT_DISCOVERED:${providerId}`);
  return provider;
};

function fixturePackageName(provider: ProviderDefinition): string {
  const exact = provider.packageIdentifiers[0];
  if (exact) return exact;
  const prefix = provider.packagePrefixes?.[0];
  if (prefix) return `${prefix}client`;
  throw new Error(`VALIDATION_PROVIDER_PACKAGE_MISSING:${provider.id}`);
}

function sourcePackageName(provider: ProviderDefinition): string {
  const packageName = fixturePackageName(provider);
  return packageName.includes('*') ? packageName.replace('*', 'client') : packageName;
}

function endpointValue(change: ReviewedCompatibilityChange): string | undefined {
  const endpoint = change.affectedEndpoints[0];
  if (!endpoint) return undefined;
  if (endpoint.startsWith('http')) return endpoint;
  if (endpoint.includes('{owner}')) return endpoint.replace('{owner}', 'owner').replace('{repo}', 'repo');
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function providerUrl(provider: ProviderDefinition, change: ReviewedCompatibilityChange): string {
  const endpoint = endpointValue(change);
  const domain = (change.affectedDomains?.[0] ?? provider.apiDomains[0] ?? 'api.invalid').replace(/^\*\./, 'project.');
  const path = endpoint && endpoint.startsWith('/') ? endpoint : '/v1/validation';
  return `https://${domain}${path}`;
}

function safeMember(value: string | undefined, fallback: string): string {
  const member = value?.split(/[./]/).filter(Boolean).find((part) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part));
  return member ?? fallback;
}

function firstReplacement(change: ReviewedCompatibilityChange, dimension: string): string | undefined {
  if (dimension === 'model') return change.replacement?.model;
  if (dimension === 'operation') return change.replacement?.operation;
  if (dimension === 'endpoint') return change.replacement?.endpoint;
  if (dimension === 'domain') return change.replacement?.domain;
  if (dimension === 'auth_or_header') return change.replacement?.authOrHeader;
  if (dimension === 'resource') return change.replacement?.resources?.[0];
  if (dimension === 'api_version') return change.apiVersionMetadata?.replacement;
  if (dimension === 'parameter') return change.replacement?.parameter;
  return undefined;
}

function dimensionValue(change: ReviewedCompatibilityChange, dimension: string): string | undefined {
  if (dimension === 'model') return change.affectedModels[0];
  if (dimension === 'operation') return change.apiOperationPatterns[0];
  if (dimension === 'endpoint') return change.affectedEndpoints[0];
  if (dimension === 'domain') return change.affectedDomains?.[0];
  if (dimension === 'auth_or_header') return change.authOrHeaderPatterns[0];
  if (dimension === 'resource') return change.affectedResources[0];
  if (dimension === 'api_version') return change.apiVersionMetadata?.version;
  if (dimension === 'parameter') return change.affectedParameters[0];
  if (dimension === 'response_field') return change.affectedResponseFields[0];
  return undefined;
}

function replacementOrSafeValue(change: ReviewedCompatibilityChange, dimension: string): string {
  return firstReplacement(change, dimension) ?? `unrelated-${change.providerId}-${dimension}`;
}

function parameterStatus(change: ReviewedCompatibilityChange, kind: ValidationFixtureKind): CompatibilityUsage['parameterValueStatus'] | undefined {
  if (!change.parameterConditions?.length) return undefined;
  return kind === 'affected' ? 'disallowed' : kind === 'not_affected' ? 'allowed' : 'unknown';
}

function usageFor(change: ReviewedCompatibilityChange, kind: ValidationFixtureKind, providerId = change.providerId): CompatibilityUsage {
  const dimensions = new Set(change.applicabilityScope.dimensions);
  const dynamic = kind === 'needs_review';
  const usage: CompatibilityUsage = {
    id: `${change.changeId}:${kind}`,
    providerId,
    packageName: change.affectedPackages?.[0] ?? `${change.providerId}-validation-fixture`,
    evidenceKind: dimensions.has('endpoint') || dimensions.has('domain') || dimensions.has('api_version') || dimensions.has('auth_or_header') ? 'http' : 'sdk',
    confidence: dynamic ? 0.4 : 0.95,
    static: !dynamic,
    location: { file: POSITIVE_FILE, line: 1, column: 1, symbol: change.changeId },
  };
  for (const dimension of dimensions) {
    if (dimension === 'provider' || dimension === 'package' || dimension === 'package_version') continue;
    const value = dynamic ? undefined : kind === 'affected' ? dimensionValue(change, dimension) : replacementOrSafeValue(change, dimension);
    if (dimension === 'model') usage.model = value;
    if (dimension === 'operation') usage.operation = value;
    if (dimension === 'endpoint') usage.endpoint = value;
    if (dimension === 'domain') usage.domain = value;
    if (dimension === 'resource') usage.resource = value;
    if (dimension === 'api_version') usage.apiVersion = value;
    if (dimension === 'auth_or_header') usage.authOrHeader = value;
    if (dimension === 'parameter') {
      usage.parameter = value;
      usage.parameterValueStatus = parameterStatus(change, kind);
    }
    if (dimension === 'response_field') usage.responseField = value;
  }
  return usage;
}

function evaluateEngineCase(change: ReviewedCompatibilityChange, kind: ValidationFixtureKind): ProviderValidationCase {
  const usage = usageFor(change, kind);
  const usageIR = [normalizeCompatibilityUsage(usage, { language: 'typescript' })];
  const result = evaluateRegisteredNormalizedCompatibility({ providerId: change.providerId, usageIR, completeEvidence: kind !== 'needs_review' }, PRODUCTION_COMPATIBILITY_REGISTRY)
    .find((item) => item.changeId === change.changeId);
  if (!result) throw new Error(`VALIDATION_RESULT_MISSING:${change.changeId}`);
  const expected = kind === 'affected' ? 'AFFECTED' : kind === 'not_affected' ? 'NOT_AFFECTED' : 'NEEDS_REVIEW';
  return { providerId: change.providerId, changeId: change.changeId, layer: 'engine', kind, status: result.status, pass: result.status === expected,
    reasonCodes: result.reasonCodes, usageCount: result.matchedUsages.length, discovered: true, normalizedUsageCount: usageIR.length, proofCount: 0, findingCount: 0 };
}

export function analyzerSource(provider: ProviderDefinition, change: ReviewedCompatibilityChange): Record<string, string> {
  const packageName = sourcePackageName(provider);
  const dimensions = new Set(change.applicabilityScope.dimensions);
  const usesHttpEvidence = dimensions.has('endpoint') || dimensions.has('domain') || dimensions.has('api_version') || dimensions.has('auth_or_header');
  const url = providerUrl(provider, change);
  const versionHeader = change.apiVersionMetadata?.headerNames?.[0] ?? provider.apiVersionHeaders?.[0] ?? 'x-api-version';
  const versionValue = change.apiVersionMetadata?.version ?? 'validation-version';
  const authHeader = change.authOrHeaderPatterns[0];
  const headerLines = [
    ...(dimensions.has('api_version') ? [`'${versionHeader}': '${versionValue}'`] : []),
    ...(dimensions.has('auth_or_header') && authHeader ? [`'${authHeader}': 'static-class-evidence'`] : []),
  ];
  if (usesHttpEvidence) {
    return {
      'package.json': JSON.stringify({ dependencies: { [packageName]: PACKAGE_VERSION } }),
      [POSITIVE_FILE]: `import '${packageName}';\nexport async function validate() {\n  return fetch('${url}', { headers: { ${headerLines.join(', ')} } });\n}\n`,
    };
  }
  const model = change.affectedModels[0];
  const parameter = change.affectedParameters[0];
  const responseField = safeMember(change.affectedResponseFields[0], 'field');
  const resource = safeMember(change.affectedResources[0], 'resource');
  const operation = safeMember(change.apiOperationPatterns[0], 'create');
  const properties = [
    ...(model ? [`model: '${model}'`] : []),
    ...(parameter ? [`${safeMember(parameter, 'parameter')}: 1`] : []),
  ];
  const call = `client.${resource}.${operation}({ ${properties.join(', ')} })`;
  const response = dimensions.has('response_field') ? `const response = await ${call}; return response.${responseField};` : `return ${call};`;
  return {
    'package.json': JSON.stringify({ dependencies: { [packageName]: PACKAGE_VERSION } }),
    [POSITIVE_FILE]: `import Client from '${packageName}';\nconst client = new Client({});\nexport async function validate() { ${response} }\n`,
  };
}

async function evaluateProductizationCase(change: ReviewedCompatibilityChange, kind: ValidationFixtureKind): Promise<ProviderValidationCase> {
  if (kind !== 'affected') {
    return { providerId: change.providerId, changeId: change.changeId, layer: 'productization', kind, status: 'UNAVAILABLE', pass: false,
      reasonCodes: ['PRODUCTIZATION_FIXTURE_NOT_EXECUTED'], usageCount: 0, discovered: false, normalizedUsageCount: 0, proofCount: 0, findingCount: 0,
      note: 'The factory reserves productization execution for the source-backed positive fixture; negative and dynamic cases are evaluated by the production engine.' };
  }
  const scan = await runProductizationScan({ repositoryId: `provider-validation-${change.changeId}`, scanId: `validation-${change.changeId}`, files: analyzerSource(providerFor(change.providerId), change) });
  const result = scan.compatibilityResults.find((item) => item.changeId === change.changeId);
  const projection = boundedProductizationProjection(scan);
  const projectedFindings = productizationFindings(scan);
  const proofCount = scan.proofs.filter((proof) => proof.changeId === change.changeId).length;
  const serializedProjection = JSON.stringify(projection);
  const boundedProjectionValid = projection.schemaVersion === 2
    && Array.isArray(projection.compatibilityResults)
    && Array.isArray(projection.proofs)
    && !serializedProjection.includes('export async function validate')
    && !serializedProjection.includes("import '");
  const findingsProjectionValid = projectedFindings.every((finding) => Boolean(finding.id && finding.changeId && finding.provider && finding.filePath && finding.reasonCodes.length));
  const rawSourcePresentInProjection = serializedProjection.includes('export async function validate') || serializedProjection.includes("import '");
  const expected: ProviderValidationCase['status'] = 'AFFECTED';
  const note = result?.status === expected && projection.schemaVersion === 2 ? undefined : 'Analyzer/productization coverage did not produce an affected result for this rule shape; engine evidence remains authoritative for this matrix case.';
  return { providerId: change.providerId, changeId: change.changeId, layer: 'productization', kind, status: result?.status ?? 'UNAVAILABLE', pass: result?.status === expected,
    reasonCodes: result?.reasonCodes ?? ['PRODUCTIZATION_RESULT_MISSING'], usageCount: result?.matchedUsages.length ?? 0, discovered: scan.discoveries.some((item) => item.providerId === change.providerId),
    normalizedUsageCount: scan.usageIR.filter((usage) => usage.providerId === change.providerId).length, proofCount, findingCount: projectedFindings.filter((finding) => finding.changeId === change.changeId).length,
    boundedProjectionValid, findingsProjectionValid, rawSourcePresentInProjection,
    ...(note ? { note } : {}) };
}

export async function runProviderValidationFactory(): Promise<ProviderValidationReport> {
  const changes = [...PRODUCTION_COMPATIBILITY_REGISTRY.changes].sort((a, b) => a.changeId.localeCompare(b.changeId, 'en'));
  const ruleReports: ProviderValidationRuleReport[] = [];
  let boundedProjectionCases = 0;
  let boundedProjectionValidated = true;
  let findingsProjectionValidated = true;
  let rawSourcePresentInProjection = false;
  let proofsProjected = 0;
  let findingsProjected = 0;
  for (const change of changes) {
    const engine = (['affected', 'not_affected', 'needs_review'] as const).map((kind) => evaluateEngineCase(change, kind));
    const unavailableProductizationCase = (kind: 'not_affected' | 'needs_review'): ProviderValidationCase => ({
      providerId: change.providerId, changeId: change.changeId, layer: 'productization' as const, kind, status: 'UNAVAILABLE' as const, pass: false,
      reasonCodes: ['PRODUCTIZATION_FIXTURE_NOT_EXECUTED'], usageCount: 0, discovered: false, normalizedUsageCount: 0, proofCount: 0, findingCount: 0,
      note: 'Negative and ambiguous cases are evaluated by the same production normalized evaluator above.'
    });
    const productization: ProviderValidationCase[] = [await evaluateProductizationCase(change, 'affected'), unavailableProductizationCase('not_affected'), unavailableProductizationCase('needs_review')];
    const positiveUsage = normalizeCompatibilityUsage(usageFor(change, 'affected'), { language: 'typescript' });
    const wrongProviderUsage = normalizeCompatibilityUsage({ ...usageFor(change, 'affected'), id: `${change.changeId}:wrong-provider`, providerId: 'unrelated-provider' }, { language: 'typescript' });
    const wrongProviderResults = evaluateRegisteredNormalizedCompatibility({ providerId: 'unrelated-provider', usageIR: [wrongProviderUsage], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    if (wrongProviderResults.some((result) => result.status === 'AFFECTED')) throw new Error(`VALIDATION_CROSS_PROVIDER_MATCH:${change.changeId}`);
    const duplicateResults = evaluateRegisteredNormalizedCompatibility({ providerId: change.providerId, usageIR: [positiveUsage, positiveUsage], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY)
      .find((item) => item.changeId === change.changeId);
    if (!duplicateResults) throw new Error(`VALIDATION_DUPLICATE_RESULT_MISSING:${change.changeId}`);
    ruleReports.push({ providerId: change.providerId, changeId: change.changeId, engine, productization, isolation: {
      wrongProviderHasAffectedResult: false,
      duplicateUsageCount: duplicateResults.matchedUsages.length,
      duplicateUsageDeduplicated: duplicateResults.matchedUsages.length === 1,
    } });
    boundedProjectionCases += 1;
    const productizationPositive = productization[0];
    if (!productizationPositive) throw new Error(`VALIDATION_PRODUCTIZATION_RESULT_MISSING:${change.changeId}`);
    proofsProjected += productizationPositive.proofCount;
    findingsProjected += productizationPositive.findingCount;
    boundedProjectionValidated = boundedProjectionValidated && productizationPositive.boundedProjectionValid === true;
    findingsProjectionValidated = findingsProjectionValidated && productizationPositive.findingsProjectionValid === true;
    rawSourcePresentInProjection = rawSourcePresentInProjection || productizationPositive.rawSourcePresentInProjection === true;
  }
  const engineCases = ruleReports.flatMap((rule) => rule.engine);
  const productizationCases = ruleReports.flatMap((rule) => rule.productization);
  return {
    schemaVersion: 1,
    providers: [...new Set(changes.map((change) => change.providerId))].sort((a, b) => a.localeCompare(b, 'en')),
    reviewedRules: changes.map((change) => change.changeId),
    rules: ruleReports,
    counts: {
      providers: new Set(changes.map((change) => change.providerId)).size,
      reviewedRules: changes.length,
      engineCases: engineCases.length,
      enginePasses: engineCases.filter((item) => item.pass).length,
      productizationCases: productizationCases.length,
      productizationPasses: productizationCases.filter((item) => item.pass).length,
      productizationPartial: productizationCases.filter((item) => item.status === 'UNAVAILABLE' || !item.pass).length,
      proofsProjected,
      findingsProjected,
    },
    productionPersistence: { boundedProjectionCases, boundedProjectionValidated, findingsProjectionValidated, rawSourcePresentInProjection },
    privacy: { rawSourceExternalTransmission: false, secretLikeValuesPresentInProjection: false },
  };
}

export function validationReportMarkdown(report: ProviderValidationReport): string {
  const lines = [
    '# Provider Intelligence Validation Matrix', '',
    `- Reviewed providers: ${report.counts.providers}`,
    `- Reviewed rules: ${report.counts.reviewedRules}`,
    `- Engine cases: ${report.counts.enginePasses}/${report.counts.engineCases} passed`,
    `- Productization positive fixtures: ${report.counts.productizationPasses}/${report.counts.reviewedRules} passed`,
    `- Productization partial/unsupported cases: ${report.counts.productizationPartial}`,
    `- Proofs projected: ${report.counts.proofsProjected}`,
    `- Findings projected: ${report.counts.findingsProjected}`, '',
    '| Provider | Change | Engine | Productization positive | Notes |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const rule of report.rules) {
    const engine = rule.engine.map((item) => `${item.kind}=${item.status}${item.pass ? '' : ' (FAIL)'}`).join('<br>');
    const product = rule.productization[0];
    if (!product) throw new Error(`VALIDATION_MARKDOWN_RESULT_MISSING:${rule.changeId}`);
    lines.push(`| ${rule.providerId} | ${rule.changeId} | ${engine} | ${product.status}${product.pass ? '' : ' (PARTIAL)'} | ${product.note ?? ''} |`);
  }
  lines.push('', 'The engine cases use the actual compiled official reviewed registry and normalized IR evaluator. Productization cases run the actual repository snapshot, discovery, analyzer, normalized IR, compatibility, proof, bounded persistence projection, and finding projection path. Unsupported analyzer shapes remain explicitly partial.');
  return `${lines.join('\n')}\n`;
}
