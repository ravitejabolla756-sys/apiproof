import { z } from 'zod';

export const CompatibilityChangeTypeSchema = z.enum([
  'parameter_removed', 'parameter_renamed', 'parameter_required',
  'method_removed', 'method_renamed', 'endpoint_removed', 'model_retired',
  'response_field_removed', 'enum_changed', 'api_version_retired',
]);
export type CompatibilityChangeType = z.infer<typeof CompatibilityChangeTypeSchema>;

export const CompatibilitySourceTypeSchema = z.enum([
  'official-documentation', 'official-changelog', 'official-advisory', 'official-api-reference',
  'release-notes', 'migration-guide', 'deprecation-notice', 'api-specification', 'sdk-release', 'provider-announcement',
]);
export type CompatibilitySourceType = z.infer<typeof CompatibilitySourceTypeSchema>;

export const CompatibilityReviewSchema = z.strictObject({
  status: z.enum(['draft', 'reviewed', 'verified']), reviewer: z.string().min(1),
  reviewedAt: z.iso.date(), provenance: z.enum(['official', 'synthetic']),
});

export const ReviewedCompatibilityChangeSchema = z.strictObject({
  providerId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  changeId: z.string().min(1).max(128), title: z.string().min(1).max(500),
  description: z.string().min(1).max(8_000),
  changeType: CompatibilityChangeTypeSchema, publishedAt: z.iso.date().optional(),
  effectiveAt: z.iso.date().optional(), removalAt: z.iso.date().optional(),
  officialSourceUrl: z.url(), sourceType: CompatibilitySourceTypeSchema,
  affectedPackages: z.array(z.string().min(1)).min(1), affectedVersionRange: z.string().min(1).optional(),
  apiOperationPatterns: z.array(z.string().min(1)).max(30),
  affectedParameters: z.array(z.string().min(1)).max(30),
  affectedResponseFields: z.array(z.string().min(1)).max(30),
  affectedEndpoints: z.array(z.string().min(1)).max(30),
  affectedModels: z.array(z.string().min(1)).max(30),
  enumMetadata: z.strictObject({ name: z.string().min(1), removedValues: z.array(z.string().min(1)), addedValues: z.array(z.string().min(1)) }).optional(),
  apiVersionMetadata: z.strictObject({ version: z.string().min(1), replacement: z.string().optional() }).optional(),
  replacement: z.strictObject({ operation: z.string().optional(), parameter: z.string().optional(), endpoint: z.string().optional(), model: z.string().optional() }).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  review: CompatibilityReviewSchema,
  evidence: z.array(z.strictObject({ url: z.url(), summary: z.string().min(1).max(2_000), accessedAt: z.iso.date() })).min(1),
});
export type ReviewedCompatibilityChange = z.infer<typeof ReviewedCompatibilityChangeSchema>;

export const CompatibilityStatusSchema = z.enum(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
export type CompatibilityStatus = z.infer<typeof CompatibilityStatusSchema>;
export const VersionAssessmentSchema = z.enum(['in-range', 'outside-range', 'declared-only', 'unknown', 'not-constrained']);
export type VersionAssessment = z.infer<typeof VersionAssessmentSchema>;

export const CompatibilityUsageSchema = z.strictObject({
  id: z.string().min(1), providerId: z.string().min(1), packageName: z.string().min(1).optional(),
  operation: z.string().optional(), model: z.string().optional(), parameter: z.string().optional(), responseField: z.string().optional(),
  endpoint: z.string().optional(), evidenceKind: z.enum(['sdk', 'http', 'import', 'environment']),
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
  versionAssessment: VersionAssessmentSchema, matchedUsages: z.array(CompatibilityUsageSchema),
  usageAssessment: z.enum(['matched', 'not-used', 'uncertain', 'not-applicable']),
  exactFile: z.string().nullable(), exactLine: z.number().int().positive().nullable(), exactSymbol: z.string().nullable(),
  matchedParameter: z.string().nullable(), matchedModel: z.string().nullable(), matchedEndpoint: z.string().nullable(),
  evidence: z.array(z.strictObject({ file: z.string(), line: z.number().int().positive(), column: z.number().int().positive(), symbol: z.string().optional(), detail: z.string() })),
  proofEvidence: z.array(z.strictObject({ kind: z.enum(['usage', 'version', 'official-source', 'review']), detail: z.string(), file: z.string().optional(), line: z.number().int().positive().optional(), url: z.string().url().optional() })),
  reasonCodes: z.array(z.string()).min(1), officialSourceReference: z.string().url(),
  confidence: z.number().min(0).max(1), evidenceCoverage: z.enum(['complete', 'partial', 'insufficient']),
  recommendedNextAction: z.enum(['NO_ACTION', 'MANUAL_REVIEW', 'MIGRATION_NOT_AVAILABLE']),
  migrationAvailable: z.boolean(), verificationAvailable: z.boolean(),
  reviewStatus: z.enum(['draft', 'reviewed', 'verified']), provenance: z.enum(['official', 'synthetic']),
});
export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>;
