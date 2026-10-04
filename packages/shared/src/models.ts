import { z } from 'zod';
import { Text, SymbolPath, ChangeRuleSchema, ChangeTypeSchema, EvidenceSourceSchema, ReviewSchema, ReasonCodeSchema } from './change-rules.js';
import { NormalizedUsageIRSchema } from './usage-ir.js';

export const ApiChangeSchema = z.strictObject({
  provider: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  id: z.string().regex(/^[\w.-]{1,128}$/),
  title: Text,
  description: Text,
  packageName: z.string().min(1).max(200),
  affectedSymbols: z.array(z.strictObject({
    symbol: SymbolPath,
    match: z.enum(['exact', 'prefix']),
    kind: z.enum(['method', 'type', 'resource']),
  })).min(1).max(100),
  oldBehavior: Text,
  newBehavior: Text,
  migrationInstructions: z.array(Text).min(1).max(50),
  sourceUrl: z.url().refine((url) => ['https:', 'http:'].includes(new URL(url).protocol)).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  // These describe package versions, not Stripe's date-based API versions.
  affectedSdkVersions: z.string().min(1).max(200).optional(),
  targetSdkVersion: z.string().min(1).max(100).optional(),
  apiVersion: z.string().min(1).max(100).optional(),
  effectiveDate: z.iso.date().optional(),
  provenance: z.enum(['synthetic', 'official']),
  changeType: ChangeTypeSchema.optional(),
  resources: z.array(SymbolPath).min(1).max(30).optional(),
  rules: z.array(ChangeRuleSchema).min(1).max(100).optional(),
  evidenceSources: z.array(EvidenceSourceSchema).min(1).max(10).optional(),
  review: ReviewSchema.optional(),
  versionScope: z.enum(['sdk', 'api-and-sdk']).optional(),
  assumptions: z.array(Text).max(20).optional(),
}).refine((change) => change.provenance !== 'official' || change.sourceUrl !== undefined, {
  message: 'Official changes require a source URL.', path: ['sourceUrl'],
});
export type ApiChange = z.infer<typeof ApiChangeSchema>;

export const RegistryChangeSchema = ApiChangeSchema.safeExtend({
  provenance: z.literal('official'), changeType: ChangeTypeSchema,
  resources: z.array(SymbolPath).min(1).max(30), rules: z.array(ChangeRuleSchema).min(1).max(100),
  evidenceSources: z.array(EvidenceSourceSchema).min(1).max(10), review: ReviewSchema,
  versionScope: z.enum(['sdk', 'api-and-sdk']),
  assumptions: z.array(Text).min(1).max(20),
}).refine((change) => change.evidenceSources.some((source) => source.url === change.sourceUrl), {
  message: 'Primary source URL must be included in evidenceSources.',
});
export type RegistryChange = z.infer<typeof RegistryChangeSchema>;

export const LocationSchema = z.strictObject({
  file: z.string().min(1),
  start: z.strictObject({ line: z.number().int().positive(), column: z.number().int().positive() }),
  end: z.strictObject({ line: z.number().int().positive(), column: z.number().int().positive() }),
});
export type CodeLocation = z.infer<typeof LocationSchema>;

export const SupportedLanguageSchema = z.enum(['typescript', 'javascript', 'python', 'go', 'java', 'kotlin', 'csharp', 'ruby', 'rust']);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const ArgumentFactSchema = z.strictObject({
  index: z.number().int().nonnegative(), complete: z.boolean(),
  properties: z.array(z.strictObject({ path: z.string(), location: LocationSchema, literalHash: z.string().optional() })),
  builders: z.array(z.strictObject({ sourceFunction: z.string(), definition: LocationSchema, callSite: LocationSchema })).optional(),
});
export type ArgumentFact = z.infer<typeof ArgumentFactSchema>;

export const UsageFindingSchema = z.strictObject({
  id: z.string(),
  provider: z.string(),
  kind: z.enum(['import', 'construction', 'method', 'type', 'resource', 'response-field']),
  semantics: z.enum(['invocation', 'optional-invocation', 'method-reference', 'property-access', 'capability-check']).optional(),
  symbol: z.string(),
  location: LocationSchema,
  context: z.strictObject({ function: z.string().nullable(), class: z.string().nullable() }),
  evidence: z.strictObject({
    binding: LocationSchema,
    basis: z.enum(['import-binding', 'require-binding', 'type-annotation']),
  }),
  confidence: z.number().min(0).max(1),
  arguments: z.array(ArgumentFactSchema).optional(),
  response: z.strictObject({
    originKind: z.enum(['method', 'type']), originSymbol: z.string(),
    fieldPath: z.string(), originLocation: LocationSchema,
    callbackLocation: LocationSchema.optional(),
  }).optional(),
});
export type UsageFinding = z.infer<typeof UsageFindingSchema>;

export const DependencyFindingSchema = z.strictObject({
  manifest: z.string(),
  packageName: z.string(),
  declarations: z.array(z.strictObject({ section: z.string(), range: z.string() })),
  installedVersion: z.string().nullable(),
  lockedVersion: z.string().nullable(),
  lockfile: z.string().nullable(),
  versionResolution: z.strictObject({
    version: z.string().nullable(), source: z.enum(['installed', 'lockfile', 'declared-exact', 'unknown']),
    certainty: z.enum(['observed', 'locked', 'declared', 'unknown']),
  }).optional(),
});
export type DependencyFinding = z.infer<typeof DependencyFindingSchema>;

export const DiagnosticSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  file: z.string().optional(),
  reasonCode: ReasonCodeSchema.optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const ScanResultSchema = z.strictObject({
  schemaVersion: z.enum(['1.0', '1.1', '1.2']),
  provider: z.string(),
  language: SupportedLanguageSchema,
  providerUsed: z.boolean(),
  dependencies: z.array(DependencyFindingSchema),
  usages: z.array(UsageFindingSchema),
  /** Optional language-neutral projection; legacy consumers continue using `usages`. */
  usageIR: z.array(NormalizedUsageIRSchema).optional(),
  diagnostics: z.array(DiagnosticSchema),
  coverage: z.strictObject({
    scope: z.literal('supported-static-patterns'),
    filesAnalyzed: z.number().int().nonnegative(),
    filesSkipped: z.number().int().nonnegative(),
    complete: z.boolean(),
    limitations: z.array(z.string()),
  }),
  audit: z.strictObject({
    toolVersion: z.enum(['0.1.0', '0.2.0', '0.2.5', '0.3.0', '0.4.0', '0.5.0', '0.6.0', '0.7.0']),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.literal('static-read-only'),
  }),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

export const ImpactFindingSchema = z.strictObject({
  usageId: z.string(),
  changeId: z.string(),
  location: LocationSchema,
  symbol: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  versionAssessment: z.enum(['in-range', 'unknown', 'not-constrained']),
  matchedRule: z.string(),
  matchedRuleIndex: z.number().int().nonnegative().optional(),
  affected: z.literal(true),
  reasonCodes: z.array(ReasonCodeSchema).min(1),
  evidence: z.array(z.strictObject({
    kind: z.enum(['method-call', 'method-reference', 'capability-check', 'resource', 'parameter', 'parameter-builder', 'promise-callback', 'response-field', 'type-reference', 'binding', 'version', 'official-source']),
    symbol: z.string().optional(), name: z.string().optional(), location: LocationSchema.optional(),
    callSite: LocationSchema.optional(),
    detail: z.string().optional(), url: z.string().optional(),
  })).min(1),
});
export type ImpactFinding = z.infer<typeof ImpactFindingSchema>;

export const ImpactResultSchema = z.strictObject({
  schemaVersion: z.enum(['1.0', '1.1', '1.2']),
  analysisMode: z.enum(['fixture', 'reviewed-registry']),
  change: ApiChangeSchema,
  changeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['potentially-affected', 'no-matched-usage', 'inconclusive']),
  scan: ScanResultSchema,
  impacts: z.array(ImpactFindingSchema),
  diagnostics: z.array(DiagnosticSchema),
  verification: z.strictObject({
    status: z.literal('not-run'),
    reason: z.string(),
  }),
});
export type ImpactResult = z.infer<typeof ImpactResultSchema>;
export type VerificationResult = ImpactResult['verification'];
