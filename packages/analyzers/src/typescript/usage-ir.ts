import { NormalizedUsageIRSchema } from '@apiproof/shared';
import type { CompatibilityUsage, NormalizedUsageIR, UsageFinding } from '@apiproof/shared';

export interface UsageIRContext {
  language?: NormalizedUsageIR['language'];
  declaredVersion?: string | null;
  resolvedVersion?: string | null;
  versionSource?: NormalizedUsageIR['versionSource'];
  versionConfidence?: NormalizedUsageIR['versionConfidence'];
}

function hostnameFromEndpoint(endpoint: string | undefined): string | undefined {
  if (!endpoint) return undefined;
  try {
    const url = endpoint.includes('://') ? new URL(endpoint) : undefined;
    const hostname = url?.hostname ?? (endpoint.includes('/') ? undefined : endpoint);
    return hostname?.toLowerCase().replace(/\.$/, '') || undefined;
  } catch {
    return undefined;
  }
}

/** Adapter boundary from the existing TS/JS evidence contract to language-neutral IR. */
export function normalizeCompatibilityUsage(usage: CompatibilityUsage, context: UsageIRContext = {}): NormalizedUsageIR {
  const operation = usage.operation;
  const segments = operation?.split('.').filter(Boolean) ?? [];
  const endpoint = usage.endpoint;
  const resource = usage.resource ?? segments[0];
  return NormalizedUsageIRSchema.parse({
    id: usage.id, language: context.language ?? 'typescript', providerId: usage.providerId, packageName: usage.packageName,
    declaredVersion: context.declaredVersion ?? null, resolvedVersion: context.resolvedVersion ?? null,
    versionSource: context.versionSource ?? (context.resolvedVersion ? 'lockfile' : context.declaredVersion ? 'package-json' : 'unknown'),
    versionConfidence: context.versionConfidence ?? (context.resolvedVersion ? 'exact' : context.declaredVersion ? 'declared-only' : 'unknown'),
    operation, resource, method: segments.at(-1), endpoint, domain: usage.domain ?? hostnameFromEndpoint(endpoint), model: usage.model,
    parameters: usage.parameter ? [usage.parameter] : [],
    parameterValues: usage.parameter ? [{ parameter: usage.parameter, ...(usage.parameterValue !== undefined ? { value: usage.parameterValue } : {}), ...(usage.parameterValueStatus ? { status: usage.parameterValueStatus } : {}) }] : [],
    responseFields: usage.responseField ? [usage.responseField] : [],
    authEvidence: [], authOrHeader: usage.authOrHeader, dynamic: !usage.static, location: usage.location, confidence: usage.confidence,
    evidence: [{ kind: usage.evidenceKind === 'http' ? 'http-call' : usage.evidenceKind === 'import' ? 'import' : usage.evidenceKind === 'environment' ? 'environment' : 'sdk-call', detail: operation ?? endpoint ?? usage.parameter ?? usage.responseField ?? usage.evidenceKind, file: usage.location.file, line: usage.location.line, provenance: 'static-source' }],
  });
}

/** Converts the legacy TypeScript finding into the generic compatibility evidence shape. */
export function usageFindingToCompatibilityUsage(usage: UsageFinding, packageName: string): CompatibilityUsage {
  const isResponse = usage.kind === 'response-field';
  const isOperation = usage.kind === 'method' || usage.kind === 'construction' || usage.kind === 'resource';
  const parameter = usage.arguments?.flatMap((argument) => argument.properties.map((property) => property.path))[0];
  return {
    id: usage.id, providerId: usage.provider, packageName,
    operation: isOperation ? usage.symbol : undefined, parameter: parameter ?? (usage.kind === 'resource' && !usage.symbol.startsWith('http') ? usage.symbol : undefined),
    endpoint: usage.kind === 'resource' && usage.symbol.startsWith('http') ? usage.symbol : undefined,
    responseField: isResponse && usage.response?.fieldPath ? usage.response.fieldPath : undefined,
    evidenceKind: usage.kind === 'import' ? 'import' : usage.kind === 'resource' && usage.symbol.startsWith('http') ? 'http' : usage.kind === 'resource' ? 'environment' : 'sdk', confidence: usage.confidence, static: usage.dynamic !== true,
    location: { file: usage.location.file, line: usage.location.start.line, column: usage.location.start.column, symbol: usage.symbol },
  };
}

/** Converts any language adapter's normalized IR into the compatibility engine input. */
export function normalizedUsageToCompatibilityUsage(usage: NormalizedUsageIR): CompatibilityUsage {
  const evidenceKind = usage.evidence[0]?.kind;
  return {
    id: usage.id, providerId: usage.providerId, packageName: usage.packageName,
    operation: usage.operation, model: usage.model, parameter: usage.parameters[0], responseField: usage.responseFields[0], endpoint: usage.endpoint, domain: usage.domain, resource: usage.resource, authOrHeader: usage.authOrHeader,
    ...(usage.parameterValues?.[0]?.value !== undefined ? { parameterValue: usage.parameterValues[0].value } : {}),
    ...(usage.parameterValues?.[0]?.status ? { parameterValueStatus: usage.parameterValues[0].status } : {}),
    evidenceKind: evidenceKind === 'http-call' ? 'http' : evidenceKind === 'import' ? 'import' : evidenceKind === 'environment' ? 'environment' : 'sdk',
    confidence: usage.confidence, static: !usage.dynamic, location: usage.location,
  };
}
