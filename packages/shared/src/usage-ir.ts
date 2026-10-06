import { z } from 'zod';
import { JsonPrimitiveSchema } from './compatibility.js';

export const UsageLanguageSchema = z.enum(['typescript', 'javascript', 'python', 'go', 'java', 'kotlin', 'csharp']);
export type UsageLanguage = z.infer<typeof UsageLanguageSchema>;

export const NormalizedUsageEvidenceSchema = z.strictObject({
  kind: z.enum(['import', 'sdk-call', 'http-call', 'environment', 'version', 'binding', 'dynamic']),
  detail: z.string().min(1).max(2_000), file: z.string().optional(), line: z.number().int().positive().optional(),
  provenance: z.enum(['static-source', 'manifest', 'lockfile', 'configuration']),
});

export const NormalizedUsageIRSchema = z.strictObject({
  id: z.string().min(1), language: UsageLanguageSchema, providerId: z.string().min(1),
  packageName: z.string().min(1).optional(), declaredVersion: z.string().nullable(), resolvedVersion: z.string().nullable(),
  versionSource: z.enum(['installed', 'lockfile', 'declared-exact', 'package-json', 'unknown']),
  versionConfidence: z.enum(['exact', 'declared-only', 'unknown']),
  operation: z.string().optional(), resource: z.string().optional(), method: z.string().optional(),
  endpoint: z.string().optional(), domain: z.string().optional(), model: z.string().optional(), parameters: z.array(z.string()),
  parameterValues: z.array(z.strictObject({ parameter: z.string().min(1), value: JsonPrimitiveSchema.optional(), status: z.enum(['allowed', 'disallowed', 'unknown']).optional() })).optional(),
  responseFields: z.array(z.string()), authEvidence: z.array(z.string()), authOrHeader: z.string().optional(), apiVersion: z.string().optional(),
  dynamic: z.boolean(), location: z.strictObject({ file: z.string(), line: z.number().int().positive(), column: z.number().int().positive(), symbol: z.string().optional() }),
  confidence: z.number().min(0).max(1), evidence: z.array(NormalizedUsageEvidenceSchema).min(1),
});
export type NormalizedUsageIR = z.infer<typeof NormalizedUsageIRSchema>;
