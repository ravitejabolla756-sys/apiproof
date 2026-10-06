import semver from 'semver';
import { CompatibilityResultSchema, ReviewedCompatibilityChangeSchema } from '@apiproof/shared';
import type { CompatibilityParameterCondition, CompatibilityResult, CompatibilityUsage, NormalizedUsageIR, ReviewedCompatibilityChange, VersionAssessment } from '@apiproof/shared';
import type { ProductionChangeRegistry } from '@apiproof/providers';
import { normalizedUsageToCompatibilityUsage } from './usage-ir.js';

export interface CompatibilityInput {
  providerId: string;
  providerName?: string;
  packageName?: string;
  declaredVersion?: string | null;
  resolvedVersion?: string | null;
  versionSource?: 'installed' | 'lockfile' | 'declared-exact' | 'package-json' | 'unknown';
  versionConfidence?: 'exact' | 'declared-only' | 'unknown';
  usages: readonly CompatibilityUsage[];
  completeEvidence?: boolean;
}

export interface NormalizedCompatibilityInput {
  providerId: string;
  providerName?: string;
  usageIR: readonly NormalizedUsageIR[];
  declaredVersion?: string | null;
  resolvedVersion?: string | null;
  versionSource?: CompatibilityInput['versionSource'];
  versionConfidence?: CompatibilityInput['versionConfidence'];
  completeEvidence?: boolean;
}

export interface CompatibilityPolicy {
  /** Explicit allow-list: discovery/version-aware providers are not implicitly compatibility-enabled. */
  compatibilityProviders: ReadonlySet<string>;
  /** Production callers must opt into official-source provenance explicitly. */
  requireOfficialProvenance?: boolean;
}

function versionAssessment(input: CompatibilityInput, change: ReviewedCompatibilityChange): { assessment: VersionAssessment; exactVersion: string | null; outside: boolean } {
  const exact = input.resolvedVersion && semver.valid(input.resolvedVersion) ? input.resolvedVersion : null;
  // API-level removals can apply independently of an SDK release. In that case
  // a missing package version is not uncertainty about applicability.
  if (!change.affectedVersionRange) return { assessment: 'not-constrained', exactVersion: exact, outside: false };
  if (exact) return { assessment: semver.satisfies(exact, change.affectedVersionRange) ? 'in-range' : 'outside-range', exactVersion: exact, outside: !semver.satisfies(exact, change.affectedVersionRange) };
  return { assessment: input.declaredVersion ? 'declared-only' : 'unknown', exactVersion: null, outside: false };
}

function matchesPattern(value: string | undefined, patterns: readonly string[]): boolean {
  return Boolean(value && patterns.some((pattern) => value === pattern || value.startsWith(`${pattern}.`) || value.startsWith(`${pattern}/`)));
}

function matchesEndpointPattern(value: string | undefined, patterns: readonly string[]): boolean {
  // Route identities and operation-like endpoints are exact. Preserve the
  // established raw-URL base-route behavior for URLs with a concrete path,
  // while never broadening templated or symbolic endpoint identifiers.
  return Boolean(value && patterns.some((pattern) => value === pattern
    || (pattern.includes('://') && !pattern.includes('{') && value.startsWith(`${pattern}/`))));
}

function hostnameFromValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = value.includes('://') ? new URL(value) : undefined;
    const hostname = url?.hostname ?? (value.includes('/') ? undefined : value);
    return hostname?.toLowerCase().replace(/\.$/, '') || undefined;
  } catch {
    return undefined;
  }
}

function matchesDomainPattern(value: string | undefined, patterns: readonly string[]): boolean {
  const hostname = hostnameFromValue(value);
  return Boolean(hostname && patterns.some((pattern) => {
    const normalized = pattern.toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
    return pattern.startsWith('*.') ? hostname === normalized || hostname.endsWith(`.${normalized}`) : hostname === normalized;
  }));
}

type UsageMatch = 'match' | 'no-match' | 'uncertain';

function parameterConditionMatch(condition: CompatibilityParameterCondition, usage: CompatibilityUsage): UsageMatch {
  if (!usage.static || usage.confidence < 0.8) return 'uncertain';
  if (condition.predicate === 'non-default') {
    if (usage.parameterValueStatus === 'disallowed') return 'match';
    if (usage.parameterValueStatus === 'allowed') return 'no-match';
    return 'uncertain';
  }
  if (usage.parameterValue === undefined || !condition.values) return 'uncertain';
  const included = condition.values.some((value) => Object.is(value, usage.parameterValue));
  return (condition.predicate === 'equals' || condition.predicate === 'in') ? (included ? 'match' : 'no-match') : (included ? 'no-match' : 'match');
}

function matches(change: ReviewedCompatibilityChange, usage: CompatibilityUsage): UsageMatch {
  if (usage.providerId !== change.providerId) return 'no-match';
  const dimensions = new Set(change.applicabilityScope.dimensions);
  if (dimensions.has('package') && (!usage.packageName || !change.affectedPackages?.includes(usage.packageName))) return 'no-match';
  // SDK operation and raw HTTP endpoint are alternate ways to prove the same
  // API target. Parameters, models, and response fields remain conjunctive.
  // A dynamic or low-confidence target cannot prove non-applicability; it is
  // retained as uncertainty so compatibility evaluation fails closed.
  const operationMatch: UsageMatch = !dimensions.has('operation') ? 'no-match'
    : matchesPattern(usage.operation, change.apiOperationPatterns) ? 'match'
      : !usage.static || usage.confidence < 0.8 ? 'uncertain' : 'no-match';
  const endpointMatch: UsageMatch = !dimensions.has('endpoint') ? 'no-match'
    : matchesEndpointPattern(usage.endpoint, change.affectedEndpoints) ? 'match'
      : !usage.static || usage.confidence < 0.8 ? 'uncertain' : 'no-match';
  const targetMatches = [operationMatch, endpointMatch].filter((match) => match !== 'no-match');
  const targetMatch: UsageMatch = !dimensions.has('operation') && !dimensions.has('endpoint') ? 'match'
    : targetMatches.includes('match') ? 'match'
      : targetMatches.includes('uncertain') ? 'uncertain' : 'no-match';
  if (dimensions.has('parameter') && (!usage.parameter || !change.affectedParameters.includes(usage.parameter))) return 'no-match';
  const parameterCondition = usage.parameter ? change.parameterConditions?.find((condition) => condition.parameter === usage.parameter) : undefined;
  const parameterMatch: UsageMatch = !parameterCondition ? 'match' : parameterConditionMatch(parameterCondition, usage);
  const responseFieldMatch: UsageMatch = !dimensions.has('response_field') ? 'match'
    : usage.responseField && change.affectedResponseFields.includes(usage.responseField) ? 'match'
      : !usage.static || usage.confidence < 0.8 ? 'uncertain' : 'no-match';
  const modelMatch = !dimensions.has('model') || Boolean(usage.model && change.affectedModels.includes(usage.model));
  const resourceMatch = !dimensions.has('resource') || Boolean(usage.resource && change.affectedResources.includes(usage.resource));
  const apiVersionMatch = !dimensions.has('api_version') || Boolean(usage.apiVersion && change.apiVersionMetadata?.version === usage.apiVersion);
  const authMatch: UsageMatch = !dimensions.has('auth_or_header') ? 'match'
    : usage.authOrHeader && change.authOrHeaderPatterns.includes(usage.authOrHeader) ? 'match'
      : !usage.static || usage.confidence < 0.8 ? 'uncertain' : 'no-match';
  const domainMatch: UsageMatch = !dimensions.has('domain') ? 'match'
    : matchesDomainPattern(usage.domain ?? usage.endpoint, change.affectedDomains ?? []) ? 'match'
      : !usage.static || usage.confidence < 0.8 ? 'uncertain' : 'no-match';
  if (targetMatch === 'no-match' || domainMatch === 'no-match' || authMatch === 'no-match' || !modelMatch || !resourceMatch || !apiVersionMatch) return 'no-match';
  if (responseFieldMatch === 'no-match' || parameterMatch === 'no-match') return 'no-match';
  if (targetMatch === 'uncertain' || domainMatch === 'uncertain' || authMatch === 'uncertain' || responseFieldMatch === 'uncertain' || parameterMatch === 'uncertain') return 'uncertain';
  return 'match';
}

/** Deterministic compatibility evaluation. It never infers impact from names alone. */
export function evaluateCompatibility(input: CompatibilityInput, rawChange: unknown, policy: CompatibilityPolicy): CompatibilityResult {
  const change = ReviewedCompatibilityChangeSchema.parse(rawChange);
  const dimensions = new Set(change.applicabilityScope.dimensions);
  const version = versionAssessment(input, change);
  const matchedById = new Map<string, CompatibilityUsage>();
  const uncertainById = new Map<string, CompatibilityUsage>();
  for (const usage of input.usages) {
    const match = matches(change, usage);
    if (match === 'match' && !matchedById.has(usage.id)) matchedById.set(usage.id, usage);
    if (match === 'uncertain' && !uncertainById.has(usage.id)) uncertainById.set(usage.id, usage);
  }
  const matched = [...matchedById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const uncertain = [...uncertainById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const evidence = [...matched, ...uncertain].map((usage) => ({ file: usage.location.file, line: usage.location.line, column: usage.location.column, symbol: usage.location.symbol, detail: usage.operation ?? usage.endpoint ?? usage.parameter ?? usage.responseField ?? usage.evidenceKind }));
  const eligible = policy.compatibilityProviders.has(input.providerId) && change.review.status !== 'draft'
    && (!policy.requireOfficialProvenance || change.review.provenance === 'official');
  let status: CompatibilityResult['status'] = 'NEEDS_REVIEW';
  const reasonCodes: string[] = [];
  if (!eligible) {
    reasonCodes.push('PROVIDER_COMPATIBILITY_NOT_ENABLED');
    if (policy.requireOfficialProvenance && change.review.provenance !== 'official') reasonCodes.push('OFFICIAL_PROVENANCE_REQUIRED');
  } else if (version.outside) { status = 'NOT_AFFECTED'; reasonCodes.push('VERSION_OUTSIDE_AFFECTED_RANGE'); }
  else if ((version.assessment === 'in-range' || version.assessment === 'not-constrained') && matched.length > 0 && uncertain.length === 0 && matched.every((usage) => usage.static && usage.confidence >= 0.8)) {
    status = 'AFFECTED';
    reasonCodes.push(version.assessment === 'in-range' ? 'VERSION_IN_AFFECTED_RANGE' : 'VERSION_NOT_CONSTRAINED', matched.some((usage) => usage.parameterValueStatus === 'disallowed') ? 'MATCHED_DISALLOWED_PARAMETER_VALUE' : 'MATCHED_STATIC_USAGE');
  } else if ((version.assessment === 'in-range' || version.assessment === 'not-constrained') && matched.length === 0 && uncertain.length === 0 && input.completeEvidence) { status = 'NOT_AFFECTED'; reasonCodes.push('CHANGED_API_NOT_USED'); }
  else if (matched.length === 0 && uncertain.length === 0 && input.completeEvidence && version.assessment !== 'declared-only' && version.assessment !== 'unknown') { status = 'NOT_AFFECTED'; reasonCodes.push('CHANGED_API_NOT_USED'); }
  else {
    status = 'NEEDS_REVIEW';
    if (version.assessment === 'declared-only' || version.assessment === 'unknown') reasonCodes.push('VERSION_UNKNOWN');
    if ([...matched, ...uncertain].some((usage) => !usage.static || usage.confidence < 0.8)) reasonCodes.push('INSUFFICIENT_STATIC_EVIDENCE');
    if (uncertain.some((usage) => dimensions.has('endpoint') && !usage.endpoint)) reasonCodes.push('ENDPOINT_UNRESOLVED');
    if (uncertain.some((usage) => dimensions.has('operation') && !usage.operation)) reasonCodes.push('OPERATION_UNRESOLVED');
    if (uncertain.some((usage) => dimensions.has('domain') && (!usage.domain && !usage.endpoint || !usage.static || usage.confidence < 0.8))) reasonCodes.push('DOMAIN_UNRESOLVED');
    if (uncertain.some((usage) => dimensions.has('auth_or_header') && !usage.authOrHeader)) reasonCodes.push('AUTH_OR_HEADER_UNRESOLVED');
    if (uncertain.some((usage) => dimensions.has('response_field') && !usage.responseField)) reasonCodes.push('RESPONSE_FIELD_UNRESOLVED');
    if (uncertain.some((usage) => usage.parameter && change.parameterConditions?.some((condition) => condition.parameter === usage.parameter))) reasonCodes.push('PARAMETER_VALUE_UNRESOLVED');
    if (matched.length === 0 && uncertain.length === 0) reasonCodes.push('NO_AFFIRMATIVE_USAGE_MATCH');
  }
  if (reasonCodes.length === 0) reasonCodes.push('INSUFFICIENT_STATIC_EVIDENCE');
  const versionSource = input.versionSource ?? (input.resolvedVersion ? 'lockfile' : input.declaredVersion ? 'package-json' : 'unknown');
  const versionConfidence = input.versionConfidence ?? (input.resolvedVersion ? 'exact' : input.declaredVersion ? 'declared-only' : 'unknown');
  const primaryUsage = matched[0] ?? uncertain[0];
  const primaryCondition = primaryUsage?.parameter ? change.parameterConditions?.find((condition) => condition.parameter === primaryUsage.parameter) : undefined;
  const usageAssessment = status === 'AFFECTED' ? 'matched' : status === 'NOT_AFFECTED' && matched.length === 0 ? 'not-used' : status === 'NOT_AFFECTED' ? 'not-applicable' : matched.length > 0 || uncertain.length > 0 ? 'uncertain' : 'not-applicable';
  const recommendedNextAction = status === 'AFFECTED' ? 'MIGRATION_NOT_AVAILABLE' : status === 'NOT_AFFECTED' ? 'NO_ACTION' : 'MANUAL_REVIEW';
  const result = { providerId: input.providerId, changeId: change.changeId, status, versionAssessment: version.assessment,
    providerName: input.providerName ?? input.providerId, packageName: input.packageName ?? null,
    declaredVersion: input.declaredVersion ?? null, resolvedVersion: input.resolvedVersion ?? null, versionSource, versionConfidence,
    changeTitle: change.title, changeType: change.changeType, officialSourceUrl: change.officialSourceUrl,
    publishedAt: change.publishedAt ?? null, effectiveAt: change.effectiveAt ?? null, removalAt: change.removalAt ?? null,
    severity: change.severity, replacement: change.replacement,
    matchedUsages: matched, evidence, reasonCodes, officialSourceReference: change.officialSourceUrl,
    usageAssessment, exactFile: primaryUsage?.location.file ?? null, exactLine: primaryUsage?.location.line ?? null,
    exactSymbol: primaryUsage?.location.symbol ?? primaryUsage?.operation ?? null,
    matchedParameter: primaryUsage?.parameter ?? null, matchedModel: primaryUsage?.model ?? null,
    matchedEndpoint: primaryUsage?.endpoint ?? null,
    ...(primaryUsage ? { matchedParameterValue: primaryUsage.parameterValue ?? null, matchedParameterValueStatus: primaryUsage.parameterValueStatus ?? null, matchedParameterCondition: primaryCondition ?? null } : {}),
    proofEvidence: [
      ...matched.map((usage) => ({ kind: 'usage' as const, detail: usage.operation ?? usage.endpoint ?? usage.parameter ?? usage.responseField ?? usage.evidenceKind, file: usage.location.file, line: usage.location.line })),
      { kind: 'version' as const, detail: version.assessment === 'in-range' ? `Version is in ${change.affectedVersionRange ?? 'the reviewed scope'}.` : `Version assessment: ${version.assessment}.` },
      { kind: 'official-source' as const, detail: `${change.title}: ${change.description}`, url: change.officialSourceUrl },
      { kind: 'review' as const, detail: `Record is ${change.review.status} with ${change.review.provenance} provenance.` },
    ],
    confidence: status === 'AFFECTED' ? Math.min(...matched.map((usage) => usage.confidence), 1) : status === 'NOT_AFFECTED' ? 0.95 : 0.5,
    evidenceCoverage: input.completeEvidence ? 'complete' : 'partial', recommendedNextAction,
    migrationAvailable: false, verificationAvailable: false, reviewStatus: change.review.status, provenance: change.review.provenance } satisfies CompatibilityResult;
  return CompatibilityResultSchema.parse(result);
}

/** Provider-neutral compatibility entry point for all language adapters. */
export function evaluateNormalizedCompatibility(input: NormalizedCompatibilityInput, rawChange: unknown, policy: CompatibilityPolicy): CompatibilityResult {
  const usages = input.usageIR.map(normalizedUsageToCompatibilityUsage);
  const providerIds = new Set(input.usageIR.map((usage) => usage.providerId));
  const packageNames = new Set(input.usageIR.map((usage) => usage.packageName).filter((packageName): packageName is string => Boolean(packageName)));
  const resolvedVersions = new Set(input.usageIR.map((usage) => usage.resolvedVersion).filter((version): version is string => Boolean(version)));
  const declaredVersions = new Set(input.usageIR.map((usage) => usage.declaredVersion).filter((version): version is string => Boolean(version)));
  if (providerIds.size > 1 || [...providerIds][0] !== input.providerId) throw new Error('COMPATIBILITY_IR_PROVIDER_MISMATCH');
  const resolvedVersion = input.resolvedVersion !== undefined ? input.resolvedVersion : resolvedVersions.size === 1 ? [...resolvedVersions][0] ?? null : null;
  const declaredVersion = input.declaredVersion !== undefined ? input.declaredVersion : declaredVersions.size === 1 ? [...declaredVersions][0] ?? null : null;
  return evaluateCompatibility({
    providerId: input.providerId,
    ...(input.providerName !== undefined ? { providerName: input.providerName } : {}),
    ...(packageNames.size === 1 ? { packageName: [...packageNames][0] } : {}),
    declaredVersion, resolvedVersion,
    ...(input.versionSource !== undefined ? { versionSource: input.versionSource } : {}),
    ...(input.versionConfidence !== undefined ? { versionConfidence: input.versionConfidence } : {}),
    usages, ...(input.completeEvidence !== undefined ? { completeEvidence: input.completeEvidence } : {}),
  }, rawChange, policy);
}

/** Production entry point: records must come from the compiled official registry. */
export function evaluateRegisteredCompatibility(input: CompatibilityInput, registry: ProductionChangeRegistry, changeId: string): CompatibilityResult {
  const change = registry.byChangeId.get(changeId);
  if (!change) throw new Error(`COMPATIBILITY_CHANGE_NOT_REGISTERED:${changeId}`);
  return evaluateCompatibility(input, change, { compatibilityProviders: new Set(registry.byProvider.keys()), requireOfficialProvenance: true });
}

/** Evaluates every reviewed production change for one provider from normalized IR. */
export function evaluateRegisteredNormalizedCompatibility(
  input: NormalizedCompatibilityInput,
  registry: ProductionChangeRegistry,
): CompatibilityResult[] {
  const changes = registry.byProvider.get(input.providerId) ?? [];
  const policy: CompatibilityPolicy = { compatibilityProviders: new Set(registry.byProvider.keys()), requireOfficialProvenance: true };
  return changes.map((change) => evaluateNormalizedCompatibility(input, change, policy));
}
