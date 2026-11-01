import { z } from 'zod';

export const PatchStatusSchema = z.enum(['PATCH_READY_FOR_VALIDATION', 'PATCH_NEEDS_REVIEW', 'PATCH_INSUFFICIENT_EVIDENCE', 'PATCH_REJECTED', 'PATCH_APPLY_FAILED', 'PATCH_STATIC_VALIDATION_FAILED', 'PATCH_GENERATION_FAILED']);
export const Digest = z.string().regex(/^[a-f0-9]{64}$/);
export const PatchEditSchema = z.strictObject({
  targetId: z.string().min(1), operation: z.literal('replace-range'),
  start: z.number().int().nonnegative(), end: z.number().int().nonnegative(),
  expected: z.string().max(16_000), replacement: z.string().max(64_000),
  evidenceIds: z.array(z.string()).min(1).max(100),
});
export type PatchEdit = z.infer<typeof PatchEditSchema>;
export const PatchStageSchema = z.strictObject({ stage: z.string(), passed: z.boolean(), code: z.string() });
export const CandidatePatchSchema = z.strictObject({
  patchId: z.string(), changeId: z.string(), repositoryId: z.string(), status: PatchStatusSchema,
  files: z.array(z.strictObject({ path: z.string(), originalDigest: Digest, patchedDigest: Digest.nullable(), edits: z.array(PatchEditSchema).max(100), unifiedDiff: z.string().max(512_000) })).max(20),
  evidenceReferences: z.array(z.string()).max(500), planReferences: z.array(Digest).min(1),
  warnings: z.array(z.string().max(8_000)).max(100), validation: z.array(PatchStageSchema),
  generatedBy: z.strictObject({ implementation: z.string(), version: z.string(), model: z.string().nullable(), aiUsed: z.boolean(), changeDigest: Digest, rulesDigest: Digest, planDigest: Digest, sourceDigests: z.record(z.string(), Digest), runId: z.string(), workspace: z.string() }),
  requiresHumanReview: z.literal(true),
});
export type CandidatePatch = z.infer<typeof CandidatePatchSchema>;
export const StructuredPatchOutputSchema = z.strictObject({ edits: z.array(z.strictObject({ targetId: z.string(), replacement: z.string().max(64_000), evidenceIds: z.array(z.string()).min(1).max(100) })).max(100) });
export type StructuredPatchOutput = z.infer<typeof StructuredPatchOutputSchema>;
export const PatchLimitsSchema = z.strictObject({ maxFiles: z.number().int().min(1).max(5), maxChangedLines: z.number().int().min(1).max(150), maxEdits: z.number().int().min(1).max(50), maxReplacementChars: z.number().int().min(1).max(16_000) });
export type PatchLimits = z.infer<typeof PatchLimitsSchema>;
export const DEFAULT_PATCH_LIMITS: PatchLimits = { maxFiles: 5, maxChangedLines: 150, maxEdits: 25, maxReplacementChars: 8_000 };

const Identifier = z.string().regex(/^[A-Za-z_$][\w$]*$/);
export const PatchTransformationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('singleton-discount'), paths: z.array(Identifier).min(1), destination: Identifier, valuePolicy: z.literal('nonempty-string-or-identifier'), rejectSiblings: z.array(Identifier).min(1) }),
  z.strictObject({ kind: z.literal('member-rename'), from: Identifier, to: Identifier, receiver: Identifier, preserveArguments: z.literal(true) }),
  z.strictObject({ kind: z.literal('qualified-member-rename'), from: Identifier, to: Identifier, receiver: Identifier, preserveArguments: z.literal(true) }),
  z.strictObject({ kind: z.literal('qualified-type-rename'), from: Identifier, to: Identifier, preserveTypeArguments: z.literal(true) }),
  z.strictObject({ kind: z.literal('model-literal-rename'), property: Identifier, from: z.string().min(1).max(200), to: z.string().min(1).max(200), preserveArguments: z.literal(true) }),
  z.strictObject({ kind: z.literal('api-version-literal-rename'), property: Identifier, from: z.string().min(1).max(200), to: z.string().min(1).max(200), preserveArguments: z.literal(true) }),
  z.strictObject({ kind: z.literal('import-specifier-rename'), from: z.string().min(1).max(500), to: z.string().min(1).max(500), preserveBindings: z.literal(true) }),
  z.strictObject({ kind: z.literal('jsx-attribute-rename'), from: Identifier, to: Identifier, preserveValue: z.literal(true) }),
  z.strictObject({ kind: z.literal('identifier-rename-many'), replacements: z.array(z.strictObject({ from: Identifier, to: Identifier })).min(1).max(20), preserveBindings: z.literal(true) }),
  z.strictObject({ kind: z.literal('string-literal-rename'), from: z.string().min(1).max(500), to: z.string().min(1).max(500), preserveArguments: z.literal(true) }),
  z.strictObject({ kind: z.literal('string-literal-rename-many'), replacements: z.array(z.strictObject({ from: z.string().min(1).max(500), to: z.string().min(1).max(500) })).min(1).max(20), preserveArguments: z.literal(true) }),
]);
export type PatchTransformation = z.infer<typeof PatchTransformationSchema>;
export const PatchRuleSchema = z.strictObject({
  changeDigest: Digest,
  transformation: PatchTransformationSchema,
  sources: z.array(z.url()).min(1),
  limitations: z.array(z.string()).min(1),
});
export type PatchRule = z.infer<typeof PatchRuleSchema>;
export const PatchRuleRegistrySchema = z.strictObject({ schemaVersion: z.literal('1.0'), rules: z.record(z.string().regex(/^[a-z0-9-]+$/), PatchRuleSchema) });
