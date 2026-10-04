import { z } from 'zod';
import { CompatibilityResultSchema } from './compatibility.js';

export const MigrationRuleKindSchema = z.enum([
  'parameter_removed', 'parameter_renamed', 'parameter_required', 'method_renamed',
  'method_replaced', 'endpoint_replacement', 'model_replacement', 'response_field_rename',
]);
export type MigrationRuleKind = z.infer<typeof MigrationRuleKindSchema>;

const MigrationTransformationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('remove-parameter'), parameter: z.string().min(1) }),
  z.strictObject({ kind: z.literal('rename-parameter'), from: z.string().min(1), to: z.string().min(1) }),
  z.strictObject({ kind: z.literal('require-parameter'), parameter: z.string().min(1), value: z.string().min(1) }),
  z.strictObject({ kind: z.literal('rename-method'), from: z.string().min(1), to: z.string().min(1) }),
  z.strictObject({ kind: z.literal('replace-method'), from: z.string().min(1), to: z.string().min(1) }),
  z.strictObject({ kind: z.literal('replace-endpoint'), from: z.string().url(), to: z.string().url() }),
  z.strictObject({ kind: z.literal('replace-model'), from: z.string().min(1), to: z.string().min(1) }),
  z.strictObject({ kind: z.literal('rename-response-field'), from: z.string().min(1), to: z.string().min(1) }),
]);
export type MigrationTransformation = z.infer<typeof MigrationTransformationSchema>;

export const MigrationRuleSchema = z.strictObject({
  ruleId: z.string().regex(/^[a-z0-9-]{1,128}$/), providerId: z.string().min(1), changeId: z.string().min(1),
  kind: MigrationRuleKindSchema, supportedLanguages: z.array(z.enum(['typescript', 'javascript'])).min(1),
  preconditions: z.strictObject({ requireStatus: z.literal('AFFECTED'), requireStaticUsage: z.literal(true), requiredReasonCodes: z.array(z.string()).min(1) }),
  authorizedTargets: z.array(z.strictObject({ file: z.string().min(1), symbol: z.string().optional(), evidenceId: z.string().min(1) })).min(1),
  transformation: MigrationTransformationSchema,
  expectedOldState: z.string().min(1).max(2_000), expectedNewState: z.string().min(1).max(2_000),
  relatedTestStrategy: z.strictObject({ required: z.literal(true), description: z.string().min(1).max(2_000), testFilePatterns: z.array(z.string().min(1)).min(1) }),
  unsupportedConditions: z.array(z.string().min(1)).min(1), postconditions: z.array(z.string().min(1)).min(1),
  requiresHumanReview: z.literal(true),
});
export type MigrationRule = z.infer<typeof MigrationRuleSchema>;

export const MigrationAssessmentStatusSchema = z.enum(['READY_FOR_DETERMINISTIC_MIGRATION', 'NEEDS_REVIEW', 'REJECTED']);
export type MigrationAssessmentStatus = z.infer<typeof MigrationAssessmentStatusSchema>;
export const MigrationAssessmentSchema = z.strictObject({
  ruleId: z.string(), providerId: z.string(), changeId: z.string(), status: MigrationAssessmentStatusSchema,
  reasons: z.array(z.string()).min(1), authorizedTargets: z.array(z.strictObject({ file: z.string(), symbol: z.string().optional(), evidenceId: z.string() })),
  transformation: MigrationTransformationSchema.nullable(), expectedOldState: z.string().nullable(), expectedNewState: z.string().nullable(),
  requiresHumanReview: z.literal(true), patchGenerated: z.literal(false),
});
export type MigrationAssessment = z.infer<typeof MigrationAssessmentSchema>;

/** Contract-only gate. It proves eligibility; it never edits source or creates a patch. */
export function assessMigrationRule(proofInput: unknown, ruleInput: unknown): MigrationAssessment {
  const proof = CompatibilityResultSchema.parse(proofInput);
  const rule = MigrationRuleSchema.parse(ruleInput);
  const reasons: string[] = [];
  if (proof.providerId !== rule.providerId || proof.changeId !== rule.changeId) reasons.push('PROVIDER_OR_CHANGE_MISMATCH');
  if (proof.status !== rule.preconditions.requireStatus) reasons.push('COMPATIBILITY_NOT_AFFECTED');
  if (proof.usageAssessment !== 'matched' || proof.matchedUsages.length === 0) reasons.push('EXACT_USAGE_NOT_PROVEN');
  if (proof.matchedUsages.some((usage) => !usage.static || usage.confidence < 0.8)) reasons.push('DYNAMIC_OR_LOW_CONFIDENCE_USAGE');
  const usageFiles = new Set(proof.matchedUsages.map((usage) => usage.location.file));
  const usageIds = new Set(proof.matchedUsages.map((usage) => usage.id));
  const authorized = rule.authorizedTargets.filter((target) => usageFiles.has(target.file) && usageIds.has(target.evidenceId));
  if (authorized.length !== rule.authorizedTargets.length) reasons.push('AUTHORIZED_TARGET_NOT_PROVEN');
  if (!proof.exactFile || !usageFiles.has(proof.exactFile)) reasons.push('PRIMARY_LOCATION_NOT_PROVEN');
  const status: MigrationAssessmentStatus = reasons.length === 0 ? 'READY_FOR_DETERMINISTIC_MIGRATION' : reasons.includes('PROVIDER_OR_CHANGE_MISMATCH') ? 'REJECTED' : 'NEEDS_REVIEW';
  return MigrationAssessmentSchema.parse({ ruleId: rule.ruleId, providerId: rule.providerId, changeId: rule.changeId, status,
    reasons: reasons.length ? reasons : ['DETERMINISTIC_PRECONDITIONS_PROVEN'], authorizedTargets: authorized,
    transformation: status === 'READY_FOR_DETERMINISTIC_MIGRATION' ? rule.transformation : null,
    expectedOldState: status === 'READY_FOR_DETERMINISTIC_MIGRATION' ? rule.expectedOldState : null,
    expectedNewState: status === 'READY_FOR_DETERMINISTIC_MIGRATION' ? rule.expectedNewState : null,
    requiresHumanReview: true, patchGenerated: false });
}
