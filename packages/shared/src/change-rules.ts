import { z } from 'zod';

export const SymbolPath = z.string().regex(/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/).max(300);
export const Text = z.string().trim().min(1).max(8_000);
export const EvidenceSourceSchema = z.strictObject({
  url: z.url().refine((value) => new URL(value).protocol === 'https:'),
  summary: Text,
  quote: z.string().min(1).max(200).optional(),
  accessedAt: z.iso.date(),
});
export const ReviewSchema = z.strictObject({
  status: z.enum(['draft', 'reviewed', 'verified']),
  reviewer: Text,
  reviewerKind: z.enum(['human', 'agent']),
  reviewedAt: z.iso.date(),
  notes: Text,
}).refine((review) => review.status !== 'verified' || review.reviewerKind === 'human', {
  message: 'Verified records require independent human verification.',
});

const symbol = { symbol: SymbolPath, match: z.enum(['exact', 'prefix']), includeCapabilityChecks: z.boolean().optional() };
export const ChangeRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('method'), ...symbol, replacementSymbol: SymbolPath.optional() }),
  z.strictObject({ kind: z.literal('resource'), ...symbol, replacementSymbol: SymbolPath.optional() }),
  z.strictObject({ kind: z.literal('type'), ...symbol, replacementSymbol: SymbolPath.optional() }),
  z.strictObject({
    kind: z.literal('parameter'), ...symbol,
    argumentIndex: z.number().int().min(0).max(10), path: SymbolPath,
    condition: z.enum(['present', 'equals']), replacementPath: SymbolPath.optional(),
    value: z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()]).optional(),
  }).refine((rule) => rule.condition !== 'equals' || rule.value !== undefined, { message: 'Equals rules require a value.' }),
  z.strictObject({
    kind: z.literal('response-field'),
    methods: z.array(SymbolPath).max(30), types: z.array(SymbolPath).max(30), path: SymbolPath,
  }).refine((rule) => rule.methods.length + rule.types.length > 0, { message: 'Response rules need a method or type binding.' }),
]);
export type ChangeRule = z.infer<typeof ChangeRuleSchema>;
export const ChangeTypeSchema = z.enum([
  'method-changed', 'method-removed', 'method-renamed', 'resource-removed',
  'parameter-changed', 'parameter-removed', 'parameter-renamed',
  'response-field-changed', 'type-changed', 'symbol-deprecated',
]);

export const ReasonCodeSchema = z.enum([
  'AFFECTED_METHOD_USED', 'AFFECTED_RESOURCE_USED', 'AFFECTED_PARAMETER_PRESENT',
  'AFFECTED_RESPONSE_FIELD_REFERENCED', 'AFFECTED_TYPE_REFERENCED', 'DEPRECATED_SYMBOL_USED',
  'VERSION_IN_AFFECTED_RANGE', 'VERSION_OUTSIDE_AFFECTED_RANGE', 'VERSION_UNKNOWN',
  'VERSION_NOT_CONSTRAINED', 'SYMBOL_NOT_FOUND', 'INSUFFICIENT_STATIC_EVIDENCE',
  'API_VERSION_UNVERIFIED', 'DECLARED_VERSION_ONLY',
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
