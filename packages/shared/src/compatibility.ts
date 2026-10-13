import { z } from 'zod';

export const CompatibilityChangeTypeSchema = z.enum([
  'parameter_removed', 'parameter_renamed', 'parameter_required',
  'method_removed', 'method_renamed', 'endpoint_removed', 'model_retired',
  'response_field_removed', 'enum_changed', 'api_version_retired',
  'auth_or_header_removed',
]);
export type CompatibilityChangeType = z.infer<typeof CompatibilityChangeTypeSchema>;

export const CompatibilitySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type CompatibilitySeverity = z.infer<typeof CompatibilitySeveritySchema>;

/** Generic policy default; a human review still has to bind the resulting value. */
export function defaultSeverityForChangeType(changeType: CompatibilityChangeType): CompatibilitySeverity {
  switch (changeType) {
    case 'model_retired':
    case 'method_removed':
    case 'endpoint_removed':
    case 'api_version_retired':
    case 'auth_or_header_removed':
      return 'high';
    case 'parameter_removed':
    case 'parameter_renamed':
    case 'parameter_required':
    case 'method_renamed':
    case 'response_field_removed':
    case 'enum_changed':
      return 'medium';
  }
}

export const CompatibilitySourceTypeSchema = z.enum([
  'official-documentation', 'official-changelog', 'official-advisory', 'official-api-reference',
  'release-notes', 'migration-guide', 'deprecation-notice', 'api-specification', 'sdk-release', 'provider-announcement',
]);
export type CompatibilitySourceType = z.infer<typeof CompatibilitySourceTypeSchema>;

export const ApplicabilityDimensionSchema = z.enum([
  'provider', 'package', 'package_version', 'model', 'endpoint', 'operation', 'parameter',
  'response_field', 'api_version', 'auth_or_header', 'domain', 'enum', 'resource',
]);
export type ApplicabilityDimension = z.infer<typeof ApplicabilityDimensionSchema>;
export const ApplicabilityScopeSchema = z.strictObject({ dimensions: z.array(ApplicabilityDimensionSchema).min(1).max(12) }).superRefine((scope, ctx) => {
  if (new Set(scope.dimensions).size !== scope.dimensions.length) ctx.addIssue({ code: 'custom', message: 'Applicability dimensions must be unique.', path: ['dimensions'] });
  if (!scope.dimensions.includes('provider')) ctx.addIssue({ code: 'custom', message: 'Provider is always an authoritative applicability dimension.', path: ['dimensions'] });
});
export type ApplicabilityScope = z.infer<typeof ApplicabilityScopeSchema>;

export const JsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export type JsonPrimitive = z.infer<typeof JsonPrimitiveSchema>;

/** A source-backed condition on a parameter, independent of any provider SDK. */
export const CompatibilityParameterConditionSchema = z.strictObject({
  parameter: z.string().min(1),
  predicate: z.enum(['non-default', 'equals', 'not-equals', 'in', 'not-in']),
  values: z.array(JsonPrimitiveSchema).max(30).optional(),
}).superRefine((condition, ctx) => {
  if (condition.predicate !== 'non-default' && (!condition.values || condition.values.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'A value-based parameter predicate requires at least one value.', path: ['values'] });
  }
});
export type CompatibilityParameterCondition = z.infer<typeof CompatibilityParameterConditionSchema>;

export const CompatibilityReviewSchema = z.strictObject({
  status: z.enum(['draft', 'reviewed', 'verified']), reviewer: z.string().min(1),
  reviewedAt: z.iso.date(), provenance: z.enum(['official', 'synthetic']),
  notes: z.string().min(1).max(2_000).optional(),
  documentFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  evidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  candidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export const ReviewedCompatibilityChangeSchema = z.strictObject({
  providerId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  changeId: z.string().min(1).max(128), title: z.string().min(1).max(500),
  description: z.string().min(1).max(8_000),
  changeType: CompatibilityChangeTypeSchema, publishedAt: z.iso.date().optional(),
  effectiveAt: z.iso.date().optional(), removalAt: z.iso.date().optional(),
  officialSourceUrl: z.url(), sourceType: CompatibilitySourceTypeSchema,
  applicabilityScope: ApplicabilityScopeSchema,
  affectedPackages: z.array(z.string().min(1)).max(50).optional(), affectedVersionRange: z.string().min(1).optional(),
  apiOperationPatterns: z.array(z.string().min(1)).max(30),
  affectedParameters: z.array(z.string().min(1)).max(30),
  parameterConditions: z.array(CompatibilityParameterConditionSchema).max(30).optional(),
  affectedResponseFields: z.array(z.string().min(1)).max(30),
  affectedEndpoints: z.array(z.string().min(1)).max(30),
  affectedDomains: z.array(z.string().min(1)).max(30).optional(),
  affectedModels: z.array(z.string().min(1)).max(30),
  affectedResources: z.array(z.string().min(1)).max(30),
  authOrHeaderPatterns: z.array(z.string().min(1)).max(30),
  enumMetadata: z.strictObject({ name: z.string().min(1), removedValues: z.array(z.string().min(1)), addedValues: z.array(z.string().min(1)) }).optional(),
  apiVersionMetadata: z.strictObject({ version: z.string().min(1), replacement: z.string().optional(), headerNames: z.array(z.string().min(1)).max(20).optional() }).optional(),
  replacement: z.strictObject({ operation: z.string().optional(), parameter: z.string().optional(), endpoint: z.string().optional(), domain: z.string().optional(), authOrHeader: z.string().optional(), model: z.string().optional(), resources: z.array(z.string().min(1)).max(20).optional() }).optional(),
  severity: CompatibilitySeveritySchema,
  review: CompatibilityReviewSchema,
  evidence: z.array(z.strictObject({ url: z.url(), summary: z.string().min(1).max(2_000), accessedAt: z.iso.date() })).min(1),
});
export type ReviewedCompatibilityChange = z.infer<typeof ReviewedCompatibilityChangeSchema>;

export function validateApplicabilityScope(change: Pick<ReviewedCompatibilityChange, 'changeType' | 'applicabilityScope' | 'affectedPackages' | 'affectedVersionRange' | 'apiOperationPatterns' | 'affectedParameters' | 'parameterConditions' | 'affectedResponseFields' | 'affectedEndpoints' | 'affectedDomains' | 'affectedModels' | 'affectedResources' | 'authOrHeaderPatterns' | 'apiVersionMetadata' | 'enumMetadata'>): void {
  const dimensions = new Set(change.applicabilityScope.dimensions);
  const require = (dimension: ApplicabilityDimension, condition: boolean): void => {
    if (!dimensions.has(dimension)) throw new Error(`APPLICABILITY_SCOPE_DIMENSION_REQUIRED:${dimension}`);
    if (!condition) throw new Error(`APPLICABILITY_SCOPE_VALUE_REQUIRED:${dimension}`);
  };
  if (change.changeType === 'model_retired') require('model', change.affectedModels.length > 0);
  if (change.changeType === 'endpoint_removed') {
    const targetDimensions: ApplicabilityDimension[] = ['endpoint', 'domain', 'operation', 'resource'];
    const targetDimension = targetDimensions.find((dimension) => dimensions.has(dimension));
    if (!targetDimension) throw new Error(`APPLICABILITY_SCOPE_TARGET_REQUIRED:${targetDimensions.join('|')}`);
  }
  if (change.changeType === 'method_removed' || change.changeType === 'method_renamed') {
    require('operation', change.apiOperationPatterns.length > 0);
    if (dimensions.has('package')) require('package', Boolean(change.affectedPackages?.length));
    if (dimensions.has('package_version')) require('package_version', Boolean(change.affectedVersionRange));
  }
  if (change.changeType === 'parameter_removed' || change.changeType === 'parameter_renamed' || change.changeType === 'parameter_required') {
    if (dimensions.has('parameter')) require('parameter', change.affectedParameters.length > 0);
    if (dimensions.has('auth_or_header')) require('auth_or_header', change.authOrHeaderPatterns.length > 0);
    if (!dimensions.has('parameter') && !dimensions.has('auth_or_header')) throw new Error(`APPLICABILITY_SCOPE_TARGET_REQUIRED:parameter|auth_or_header`);
    const targetDimensions: ApplicabilityDimension[] = ['operation', 'endpoint', 'resource', 'model', 'domain'];
    if (!targetDimensions.some((dimension) => dimensions.has(dimension))) throw new Error(`APPLICABILITY_SCOPE_TARGET_REQUIRED:${targetDimensions.join('|')}`);
    if (dimensions.has('operation')) require('operation', change.apiOperationPatterns.length > 0);
    if (dimensions.has('endpoint')) require('endpoint', change.affectedEndpoints.length > 0);
    if (dimensions.has('domain')) require('domain', Boolean(change.affectedDomains?.length));
    if (dimensions.has('resource')) require('resource', change.affectedResources.length > 0);
    if (dimensions.has('model')) require('model', change.affectedModels.length > 0);
  }
  if (change.changeType === 'response_field_removed') {
    require('response_field', change.affectedResponseFields.length > 0);
    const targetDimensions: ApplicabilityDimension[] = ['operation', 'endpoint', 'resource'];
    if (!targetDimensions.some((dimension) => dimensions.has(dimension))) throw new Error(`APPLICABILITY_SCOPE_TARGET_REQUIRED:${targetDimensions.join('|')}`);
    if (dimensions.has('operation')) require('operation', change.apiOperationPatterns.length > 0);
    if (dimensions.has('endpoint')) require('endpoint', change.affectedEndpoints.length > 0);
    if (dimensions.has('resource')) require('resource', change.affectedResources.length > 0);
  }
  if (change.changeType === 'api_version_retired') require('api_version', Boolean(change.apiVersionMetadata?.version));
  if (change.changeType === 'auth_or_header_removed') require('auth_or_header', change.authOrHeaderPatterns.length > 0);
  if (change.changeType === 'enum_changed') require('enum', Boolean(change.enumMetadata));
  if (dimensions.has('package')) require('package', Boolean(change.affectedPackages?.length));
  if (dimensions.has('package_version')) {
    require('package', Boolean(change.affectedPackages?.length));
    require('package_version', Boolean(change.affectedVersionRange));
  }
  if (dimensions.has('operation')) require('operation', change.apiOperationPatterns.length > 0);
  if (dimensions.has('parameter')) require('parameter', change.affectedParameters.length > 0);
  if (dimensions.has('response_field')) require('response_field', change.affectedResponseFields.length > 0);
  if (dimensions.has('endpoint')) require('endpoint', change.affectedEndpoints.length > 0);
  if (dimensions.has('domain')) require('domain', Boolean(change.affectedDomains?.length));
  if (dimensions.has('model')) require('model', change.affectedModels.length > 0);
  if (dimensions.has('resource')) require('resource', change.affectedResources.length > 0);
  if (dimensions.has('api_version')) require('api_version', Boolean(change.apiVersionMetadata?.version));
  if (dimensions.has('auth_or_header')) require('auth_or_header', change.authOrHeaderPatterns.length > 0);
  if (dimensions.has('enum')) require('enum', Boolean(change.enumMetadata));
  if (change.parameterConditions) {
    const conditionParameters = change.parameterConditions.map((condition) => condition.parameter);
    if (new Set(conditionParameters).size !== conditionParameters.length) throw new Error('PARAMETER_CONDITION_DUPLICATE');
    if (conditionParameters.some((parameter) => !change.affectedParameters.includes(parameter))) throw new Error('PARAMETER_CONDITION_PARAMETER_NOT_AFFECTED');
  }
}

export const CompatibilityStatusSchema = z.enum(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
export type CompatibilityStatus = z.infer<typeof CompatibilityStatusSchema>;
export const VersionAssessmentSchema = z.enum(['in-range', 'outside-range', 'declared-only', 'unknown', 'not-constrained']);
export type VersionAssessment = z.infer<typeof VersionAssessmentSchema>;

export const CompatibilityUsageSchema = z.strictObject({
  id: z.string().min(1), providerId: z.string().min(1), packageName: z.string().min(1).optional(),
  operation: z.string().optional(), model: z.string().optional(), parameter: z.string().optional(), responseField: z.string().optional(), domain: z.string().optional(),
  /** Hash of a statically recovered literal; preserves the privacy contract while enabling source-backed comparisons. */
  parameterValueHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  parameterValue: JsonPrimitiveSchema.optional(), parameterValueStatus: z.enum(['allowed', 'disallowed', 'unknown']).optional(),
  endpoint: z.string().optional(), resource: z.string().optional(), apiVersion: z.string().optional(), authOrHeader: z.string().optional(), evidenceKind: z.enum(['sdk', 'http', 'import', 'environment']),
  headerEvidence: z.array(z.strictObject({ name: z.string().min(1), value: z.string().optional(), static: z.boolean(), redacted: z.boolean(), location: z.strictObject({ file: z.string(), line: z.number().int().positive(), column: z.number().int().positive() }) })).max(100).optional(),
  confidence: z.number().min(0).max(1), static: z.boolean(),
  location: z.strictObject({ file: z.string().min(1), line: z.number().int().positive(), column: z.number().int().positive(), symbol: z.string().optional() }),
});
export type CompatibilityUsage = z.infer<typeof CompatibilityUsageSchema>;

export const CompatibilityResultSchema = z.strictObject({
  providerId: z.string(), changeId: z.string(), status: CompatibilityStatusSchema,
  providerName: z.string(), packageName: z.string().nullable(),
  declaredVersion: z.string().nullable(), resolvedVersion: z.string().nullable(),
  versionSource: z.enum(['installed', 'lockfile', 'declared-exact', 'package-json', 'unknown']),
  versionConfidence: z.enum(['exact', 'declared-only', 'unknown']),
  changeTitle: z.string(), changeType: CompatibilityChangeTypeSchema,
  officialSourceUrl: z.string().url(), publishedAt: z.string().nullable(), effectiveAt: z.string().nullable(), removalAt: z.string().nullable(),
  severity: CompatibilitySeveritySchema.optional(),
  replacement: z.strictObject({ operation: z.string().optional(), parameter: z.string().optional(), endpoint: z.string().optional(), domain: z.string().optional(), authOrHeader: z.string().optional(), model: z.string().optional(), resources: z.array(z.string().min(1)).max(20).optional() }).optional(),
  versionAssessment: VersionAssessmentSchema, matchedUsages: z.array(CompatibilityUsageSchema),
  usageAssessment: z.enum(['matched', 'not-used', 'uncertain', 'not-applicable']),
  exactFile: z.string().nullable(), exactLine: z.number().int().positive().nullable(), exactSymbol: z.string().nullable(),
  matchedParameter: z.string().nullable(), matchedModel: z.string().nullable(), matchedEndpoint: z.string().nullable(),
  matchedParameterValue: JsonPrimitiveSchema.nullable().optional(), matchedParameterValueStatus: z.enum(['allowed', 'disallowed', 'unknown']).nullable().optional(),
  matchedParameterCondition: CompatibilityParameterConditionSchema.nullable().optional(),
  evidence: z.array(z.strictObject({ file: z.string(), line: z.number().int().positive(), column: z.number().int().positive(), symbol: z.string().optional(), detail: z.string() })),
  proofEvidence: z.array(z.strictObject({ kind: z.enum(['usage', 'version', 'official-source', 'review']), detail: z.string(), file: z.string().optional(), line: z.number().int().positive().optional(), url: z.string().url().optional() })),
  reasonCodes: z.array(z.string()).min(1), officialSourceReference: z.string().url(),
  confidence: z.number().min(0).max(1), evidenceCoverage: z.enum(['complete', 'partial', 'insufficient']),
  recommendedNextAction: z.enum(['NO_ACTION', 'MANUAL_REVIEW', 'MIGRATION_NOT_AVAILABLE']),
  migrationAvailable: z.boolean(), verificationAvailable: z.boolean(),
  reviewStatus: z.enum(['draft', 'reviewed', 'verified']), provenance: z.enum(['official', 'synthetic']),
});
export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>;
