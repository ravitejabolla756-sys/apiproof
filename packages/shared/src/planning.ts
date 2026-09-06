import { z } from 'zod';
import { Text, SymbolPath } from './change-rules.js';
import { LocationSchema, RegistryChangeSchema } from './models.js';

export const PlanningStatusSchema = z.enum([
  'PLAN_READY', 'PLAN_NEEDS_REVIEW', 'PLAN_INSUFFICIENT_EVIDENCE',
  'PLAN_UNSUPPORTED_PATTERN', 'PLAN_GENERATION_FAILED',
]);
export type PlanningStatus = z.infer<typeof PlanningStatusSchema>;

export const PlanningEvidenceSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9:_./-]+$/),
  kind: z.enum(['change', 'official-source', 'impact', 'fact', 'snippet']),
  label: Text,
  changeId: z.string().optional(),
  symbol: SymbolPath.optional(),
  location: LocationSchema.optional(),
  url: z.url().optional(),
});
export type PlanningEvidence = z.infer<typeof PlanningEvidenceSchema>;

export const DeterministicFactSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9:_./-]+$/),
  kind: z.enum(['change', 'package', 'operation', 'parameter', 'location', 'version', 'diagnostic', 'coverage']),
  statement: Text,
  evidenceIds: z.array(z.string().regex(/^[a-z0-9:_./-]+$/)).min(1),
  location: LocationSchema.optional(),
  symbol: SymbolPath.optional(),
});
export type DeterministicFact = z.infer<typeof DeterministicFactSchema>;

export const SourceSnippetSchema = z.strictObject({
  evidenceId: z.string().regex(/^[a-z0-9:_./-]+$/), file: z.string().min(1),
  startLine: z.number().int().positive(), endLine: z.number().int().positive(),
  text: z.string().max(12_000), redacted: z.boolean(),
});
export type SourceSnippet = z.infer<typeof SourceSnippetSchema>;

export const PlanningImpactSchema = z.strictObject({
  usageId: z.string(), changeId: z.string(), symbol: SymbolPath, location: LocationSchema,
  reason: Text, confidence: z.number().min(0).max(1), versionAssessment: z.enum(['in-range', 'unknown', 'not-constrained']),
  reasonCodes: z.array(z.string()).min(1),
});
export type PlanningImpact = z.infer<typeof PlanningImpactSchema>;

export const PlanningInputSchema = z.strictObject({
  change: RegistryChangeSchema, repository: z.string().min(1).max(1_024),
  impacts: z.array(PlanningImpactSchema).max(100), facts: z.array(DeterministicFactSchema).max(500),
  evidence: z.array(PlanningEvidenceSchema).max(500), snippets: z.array(SourceSnippetSchema).max(100),
  migrationInstructions: z.array(Text).max(50), warnings: z.array(Text).max(50),
  unresolvedQuestions: z.array(Text).max(50),
  bounds: z.strictObject({ maxSnippetLines: z.number().int().positive(), maxSnippetChars: z.number().int().positive(), maxTotalChars: z.number().int().positive() }),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/), analysisDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PlanningInput = z.infer<typeof PlanningInputSchema>;

export const PlanLocationSchema = z.strictObject({
  file: z.string().min(1), line: z.number().int().positive(), column: z.number().int().positive(), symbol: SymbolPath,
});
export type PlanLocation = z.infer<typeof PlanLocationSchema>;

export const PlanStepSchema = z.strictObject({
  id: z.string().regex(/^step-[a-z0-9-]+$/), kind: z.enum(['inspect', 'transform', 'verify']),
  description: Text, location: PlanLocationSchema, supportedBy: z.array(z.string()).min(1),
  currentField: SymbolPath.optional(), suggestedField: SymbolPath.optional(),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanRecommendationSchema = z.strictObject({
  id: z.string().regex(/^recommendation-[a-z0-9-]+$/), text: Text,
  supportedBy: z.array(z.string()).min(1), unsupportedSpeculation: z.literal(false),
});
export type PlanRecommendation = z.infer<typeof PlanRecommendationSchema>;

export const PlanningConfidenceSchema = z.strictObject({
  analysisConfidence: z.number().min(0).max(1), planningConfidence: z.number().min(0).max(1), evidenceCoverage: z.number().min(0).max(1),
  basis: z.array(Text).min(1),
});

export const PlannerAuditSchema = z.strictObject({
  planner: z.string().min(1), version: z.string().min(1), model: z.string().nullable(), generatedAt: z.iso.datetime(),
  evidenceIds: z.array(z.string()), changeDigest: z.string().regex(/^[a-f0-9]{64}$/), analysisDigest: z.string().regex(/^[a-f0-9]{64}$/),
  modelReasoningUsed: z.boolean(), validationStatus: z.enum(['validated', 'rejected']),
});

export const MigrationPlanSchema = z.strictObject({
  changeId: z.string(), provider: z.string(), repository: z.string(), status: PlanningStatusSchema,
  affectedLocations: z.array(PlanLocationSchema), facts: z.array(DeterministicFactSchema), recommendations: z.array(PlanRecommendationSchema),
  steps: z.array(PlanStepSchema), assumptions: z.array(Text), warnings: z.array(Text), unresolvedQuestions: z.array(Text),
  evidence: z.array(PlanningEvidenceSchema), confidence: PlanningConfidenceSchema, generatedBy: PlannerAuditSchema,
  requiresHumanReview: z.literal(true),
});
export type MigrationPlan = z.infer<typeof MigrationPlanSchema>;

export const ModelStepSchema = z.strictObject({
  id: z.string().regex(/^step-[a-z0-9-]+$/), kind: z.enum(['inspect', 'transform', 'verify']),
  affectedSymbol: SymbolPath, affectedParameter: SymbolPath.optional(), description: Text, transformation: Text.optional(), evidenceIds: z.array(z.string()).min(1),
  assumptions: z.array(Text).max(20), risks: z.array(Text).max(20), unresolvedQuestions: z.array(Text).max(20),
});
export const ModelOutputSchema = z.strictObject({
  summary: Text, steps: z.array(ModelStepSchema).max(100), recommendations: z.array(z.strictObject({ text: Text, evidenceIds: z.array(z.string()).min(1) })).max(100),
  assumptions: z.array(Text).max(30), risks: z.array(Text).max(30), unresolvedQuestions: z.array(Text).max(30),
});
export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export const PlanningCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/), repository: z.string().min(1), changeId: z.string(),
  expectedStatus: PlanningStatusSchema, expectedLocations: z.array(PlanLocationSchema).max(100),
  requiredWarningFragments: z.array(z.string().min(1)).max(20), explanation: Text,
});
export type PlanningCase = z.infer<typeof PlanningCaseSchema>;

export const PlanningCorpusSchema = z.strictObject({
  schemaVersion: z.literal('1.0'), id: z.string().min(1), provenance: z.literal('authored-planning-examples'),
  cases: z.array(PlanningCaseSchema).min(1).max(200),
}).refine((value) => new Set(value.cases.map((item) => item.id)).size === value.cases.length, { message: 'Duplicate planning case IDs.' });
export type PlanningCorpus = z.infer<typeof PlanningCorpusSchema>;

export const PlanningEvaluationResultSchema = z.strictObject({
  schemaVersion: z.literal('1.0'), corpusId: z.string(), cases: z.number().int().nonnegative(),
  schemaValidPlans: z.number().int().nonnegative(), correctAffectedLocations: z.number().int().nonnegative(),
  correctStatuses: z.number().int().nonnegative(),
  correctChangeIdentity: z.number().int().nonnegative(), invalidEvidenceReferences: z.number().int().nonnegative(),
  unsupportedFactInventions: z.number().int().nonnegative(), requiredWarningCoverage: z.number().min(0).max(1).nullable(),
  planningFailures: z.number().int().nonnegative(), insufficientEvidenceCases: z.number().int().nonnegative(),
  results: z.array(z.strictObject({ id: z.string(), status: z.string(), expectedStatus: PlanningStatusSchema, schemaValid: z.boolean(), locationsCorrect: z.boolean(), statusCorrect: z.boolean(), changeIdentityCorrect: z.boolean(), evidenceValid: z.boolean(), unsupportedFactInventions: z.number().int().nonnegative(), warningsCovered: z.boolean(), error: z.string().nullable() })),
});
export type PlanningEvaluationResult = z.infer<typeof PlanningEvaluationResultSchema>;
