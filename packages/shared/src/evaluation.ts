import { z } from 'zod';
import { isAnalyzableSourcePath } from './source-policy.js';

const RelativePath = z.string().regex(/^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+$/)
  .refine((value) => !value.startsWith('/') && !value.includes('//') && value !== '.');
export const ExpectedUsageSchema = z.strictObject({
  file: RelativePath.refine(isAnalyzableSourcePath, { message: 'Labels must reference analyzed TypeScript source, never secrets or excluded files.' }),
  symbol: z.string().min(1), line: z.number().int().positive(), column: z.number().int().positive(),
});
export type ExpectedUsage = z.infer<typeof ExpectedUsageSchema>;
const Attribution = z.strictObject({ name: z.string().min(1), kind: z.enum(['agent', 'human']) });
export const LabelProvenanceSchema = z.strictObject({
  authoredBy: Attribution, reviewedBy: Attribution.nullable(),
  reviewStatus: z.enum(['authored', 'reviewed', 'independently-reviewed']),
  createdAt: z.iso.date(), sourceBasis: z.string().min(10),
  origin: z.enum(['synthetic', 'externally-derived']), notes: z.string().min(10),
}).refine((item) => item.reviewStatus === 'authored' || item.reviewedBy !== null, { message: 'Reviewed labels require reviewer attribution.' })
  .refine((item) => item.reviewStatus !== 'independently-reviewed' ||
    (item.reviewedBy?.kind === 'human' && item.reviewedBy.name !== item.authoredBy.name), { message: 'Independent review requires a distinct human reviewer.' });
export const EvaluationCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/), repository: RelativePath,
  changeId: z.string().regex(/^[a-z0-9-]+$/), affected: z.boolean(),
  explanation: z.string().min(10), expectedUsages: z.array(ExpectedUsageSchema).max(100),
  provenance: LabelProvenanceSchema,
  evidencePattern: z.string().regex(/^[a-z0-9-]+$/),
  regressionId: z.string().regex(/^[a-z0-9-]+$/).optional(),
}).refine((item) => item.affected === (item.expectedUsages.length > 0), { message: 'Affected labels must have expected usages, negatives must have none.' })
  .refine((item) => new Set(item.expectedUsages.map((usage) => JSON.stringify(usage))).size === item.expectedUsages.length, { message: 'Duplicate expected usages.' });
export type EvaluationCase = z.infer<typeof EvaluationCaseSchema>;
export const CorpusSchema = z.strictObject({
  schemaVersion: z.literal('1.1'), id: z.string().min(1),
  provenance: z.literal('authored-integration-examples'),
  labelReview: z.strictObject({ reviewer: z.string().min(1), reviewerKind: z.enum(['human', 'agent']), date: z.iso.date(), notes: z.string().min(10) }),
  cases: z.array(EvaluationCaseSchema).min(1).max(1000),
}).refine((corpus) => new Set(corpus.cases.map((item) => item.id)).size === corpus.cases.length, { message: 'Duplicate case IDs.' })
  .refine((corpus) => new Set(corpus.cases.map((item) => `${item.repository}:${item.changeId}`)).size === corpus.cases.length, { message: 'Duplicate repository/change pairs.' });
export type Corpus = z.infer<typeof CorpusSchema>;

const Count = z.number().int().nonnegative();
const Rate = z.number().min(0).max(1).nullable();
export const MetricsSchema = z.strictObject({
  truePositives: Count, falsePositives: Count, trueNegatives: Count, falseNegatives: Count,
  precision: Rate, recall: Rate, f1: Rate,
});
export type Metrics = z.infer<typeof MetricsSchema>;
const BreakdownSchema = z.strictObject({
  name: z.string(), cases: Count, metrics: MetricsSchema, usageMetrics: MetricsSchema.omit({ trueNegatives: true }),
  inconclusiveCases: Count, failedCases: Count,
});
export const EvaluationResultSchema = z.strictObject({
  schemaVersion: z.literal('1.1'), corpusId: z.string(), labelDigest: z.string(),
  provenance: z.literal('authored-integration-examples'),
  repositories: Count, changeRecords: Count, groundTruthCases: Count,
  metrics: MetricsSchema,
  usageMetrics: MetricsSchema.omit({ trueNegatives: true }),
  inconclusiveCases: Count, failedCases: Count, scoredCases: Count,
  byChangeCategory: z.array(BreakdownSchema), byEvidencePattern: z.array(BreakdownSchema),
  cases: z.array(z.strictObject({
    id: z.string(), repository: z.string(), changeId: z.string(), expectedAffected: z.boolean(), predictedAffected: z.boolean().nullable(),
    changeCategory: z.string(), evidencePattern: z.string(), provenance: LabelProvenanceSchema, regressionId: z.string().optional(),
    outcome: z.enum(['TP', 'FP', 'TN', 'FN', 'ERROR']), status: z.string(),
    expectedUsages: z.array(ExpectedUsageSchema), predictedUsages: z.array(ExpectedUsageSchema),
    missedUsages: z.array(ExpectedUsageSchema), unexpectedUsages: z.array(ExpectedUsageSchema),
    explanation: z.string(), diagnostics: z.array(z.string()), inputDigest: z.string().nullable(), changeDigest: z.string().nullable(),
  })),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
