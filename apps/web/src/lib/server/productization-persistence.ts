import type { ProductizationScanResult } from '@apiproof/analyzers';

export const PRODUCTIZATION_MAX_JSON_BYTES = 1_500_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_.$/@:{}[\]#?&=+%~*'"-]{1,300}$/;
const UNSAFE_VALUE_PATTERN = /(?:sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|(?:secret|token|password|private[_-]?key)[-_][A-Za-z0-9_-]{4,}|RAW_SOURCE_MUST_)/i;

export function safeFailureCode(error: unknown, fallback: string): string {
  const value = error instanceof Error ? error.message : '';
  return /^[A-Z][A-Z0-9_]{2,80}$/.test(value) ? value : fallback;
}

function safeString(value: unknown, fallback = '[redacted]'): string {
  if (typeof value !== 'string' || value.length > 300 || /-----BEGIN/i.test(value) || UNSAFE_VALUE_PATTERN.test(value)) return fallback;
  return SAFE_IDENTIFIER.test(value) ? value : fallback;
}

function safePath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300 || !/^[-A-Za-z0-9_./\\]+$/.test(value)) return '[redacted-path]';
  return value;
}

function safeLocation(location: unknown): Record<string, unknown> {
  const item = location && typeof location === 'object' ? location as Record<string, unknown> : {};
  const start = item.start && typeof item.start === 'object' ? item.start as Record<string, unknown> : {};
  return { file: safePath(item.file), line: Number.isInteger(start.line) ? start.line : 1, column: Number.isInteger(start.column) ? start.column : 1, ...(typeof item.symbol === 'string' ? { symbol: safeString(item.symbol) } : {}) };
}

function safeUsage(usage: unknown): Record<string, unknown> {
  const item = usage && typeof usage === 'object' ? usage as Record<string, unknown> : {};
  const result: Record<string, unknown> = { id: safeString(item.id), language: safeString(item.language), providerId: safeString(item.providerId), dynamic: Boolean(item.dynamic), confidence: typeof item.confidence === 'number' ? item.confidence : 0, location: safeLocation(item.location) };
  for (const key of ['packageName', 'operation', 'resource', 'method', 'endpoint', 'domain', 'model', 'authOrHeader']) {
    if (typeof item[key] === 'string') result[key] = safeString(item[key]);
  }
  if (Array.isArray(item.parameters)) result.parameters = item.parameters.filter((value): value is string => typeof value === 'string').map((value) => safeString(value));
  if (Array.isArray(item.responseFields)) result.responseFields = item.responseFields.filter((value): value is string => typeof value === 'string').map((value) => safeString(value));
  if (Array.isArray(item.parameterValues)) result.parameterValues = item.parameterValues.map((value) => {
    const entry = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return { parameter: safeString(entry.parameter), ...(entry.status === 'allowed' || entry.status === 'disallowed' || entry.status === 'unknown' ? { status: entry.status } : {}) };
  });
  return result;
}

function safeResult(result: unknown): Record<string, unknown> {
  const item = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const keep = ['proofId', 'repositoryId', 'baselineSha', 'scanId', 'providerId', 'changeId', 'status', 'providerName', 'packageName', 'declaredVersion', 'resolvedVersion', 'versionSource', 'versionConfidence', 'changeTitle', 'changeType', 'officialSourceUrl', 'officialSourceReference', 'publishedAt', 'effectiveAt', 'removalAt', 'severity', 'replacement', 'versionAssessment', 'usageAssessment', 'exactFile', 'exactLine', 'exactSymbol', 'matchedParameter', 'matchedModel', 'matchedEndpoint', 'matchedParameterValueStatus', 'matchedParameterCondition', 'reasonCodes', 'confidence', 'evidenceCoverage', 'recommendedNextAction', 'migrationAvailable', 'verificationAvailable', 'reviewStatus', 'provenance', 'reviewer', 'reviewedAt', 'documentFingerprint', 'evidenceFingerprint', 'candidateFingerprint'];
  const output: Record<string, unknown> = {};
  for (const key of keep) if (item[key] !== undefined) output[key] = key === 'exactFile' || key === 'exactSymbol' || key === 'matchedParameter' || key === 'matchedModel' || key === 'matchedEndpoint' ? safeString(item[key], '') : item[key];
  output.matchedUsages = Array.isArray(item.matchedUsages) ? item.matchedUsages.map(safeUsage) : [];
  output.evidence = Array.isArray(item.evidence) ? item.evidence.map((entry) => {
    const value = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return { file: safePath(value.file), line: Number.isInteger(value.line) ? value.line : 1, column: Number.isInteger(value.column) ? value.column : 1, ...(typeof value.symbol === 'string' ? { symbol: safeString(value.symbol) } : {}) };
  }) : [];
  output.proofEvidence = Array.isArray(item.proofEvidence) ? item.proofEvidence.map((entry) => {
    const value = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return { kind: safeString(value.kind), ...(typeof value.file === 'string' ? { file: safePath(value.file) } : {}), ...(Number.isInteger(value.line) ? { line: value.line } : {}) };
  }) : [];
  return output;
}

/** Strict customer-visible projection. Raw source text is never part of this contract. */
export function boundedProductizationProjection(scan: ProductizationScanResult): Record<string, unknown> {
  const projection = {
    schemaVersion: 2,
    baselineSha: scan.baselineSha,
    scanId: scan.scanId,
    timingsMs: { ...scan.timingsMs },
    metrics: { ...scan.metrics },
    languages: scan.languages.map((item) => ({ language: item.language, evidenceCount: item.evidence.length })),
    discoveries: scan.discoveries.map((item) => ({ providerId: item.providerId, providerName: item.providerName, packageName: item.packageName, declaredVersion: item.declaredVersion, resolvedVersion: item.resolvedVersion, versionSource: item.versionSource, versionConfidence: item.versionConfidence, evidenceCount: item.evidence.length })),
    usageIR: scan.usageIR.map(safeUsage),
    compatibilityResults: scan.compatibilityResults.map(safeResult),
    proofs: scan.proofs.map(safeResult),
    truncated: false,
  };
  const bytes = Buffer.byteLength(JSON.stringify(projection), 'utf8');
  if (bytes > PRODUCTIZATION_MAX_JSON_BYTES) throw new Error('PROVIDER_INTELLIGENCE_EVIDENCE_LIMIT');
  return projection;
}

export function parseBoundedProductizationProjection(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const projection = item.productization && typeof item.productization === 'object' ? item.productization as Record<string, unknown> : item;
  if (projection.schemaVersion !== 2 || !Array.isArray(projection.compatibilityResults) || !Array.isArray(projection.proofs)) return null;
  const json = JSON.stringify(projection);
  if (Buffer.byteLength(json, 'utf8') > PRODUCTIZATION_MAX_JSON_BYTES) return null;
  return projection;
}
