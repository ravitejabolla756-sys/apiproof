import { z } from 'zod';
import { ImpactFindingSchema, LocationSchema, SupportedLanguageSchema } from './models.js';

const RepositoryPathSchema = z.string().min(1).max(500).refine((value) => {
  if (value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)) return false;
  return value.split('/').every((segment) => segment.length > 0 && segment !== '..');
}, 'Path must be a normalized repository-relative path.');

/** A repository-relative package/service boundary; manifest semantics remain ecosystem-specific. */
export const WorkspacePackageSchema = z.strictObject({
  id: z.string().min(1).max(200),
  repositoryId: z.string().min(1).max(200),
  path: RepositoryPathSchema,
  name: z.string().min(1).max(200).optional(),
  language: SupportedLanguageSchema,
  manifestPaths: z.array(RepositoryPathSchema).max(100),
  dependencies: z.array(z.strictObject({
    name: z.string().min(1).max(200),
    declaredVersion: z.string().max(200).nullable(),
    ecosystem: z.string().min(1).max(80),
  })).max(10_000),
});
export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;

export const RepositoryWorkspaceSchema = z.strictObject({
  repositoryId: z.string().min(1).max(200),
  workspaceId: z.string().min(1).max(200),
  packages: z.array(WorkspacePackageSchema).max(20_000),
}).superRefine((workspace, context) => {
  const packageIds = new Set<string>();
  workspace.packages.forEach((pkg, index) => {
    if (pkg.repositoryId !== workspace.repositoryId) context.addIssue({ code: 'custom', path: ['packages', index, 'repositoryId'], message: 'Package repository must match its workspace repository.' });
    if (packageIds.has(pkg.id)) context.addIssue({ code: 'custom', path: ['packages', index, 'id'], message: 'Package IDs must be unique within a repository workspace.' });
    packageIds.add(pkg.id);
  });
});
export type RepositoryWorkspace = z.infer<typeof RepositoryWorkspaceSchema>;

/** Binds one stable vendor/internal change ID to language-specific detection and migration strategies. */
export const LanguageChangeStrategySchema = z.strictObject({
  changeId: z.string().min(1).max(128),
  language: SupportedLanguageSchema,
  adapterId: z.string().min(1).max(128),
  detectionRuleId: z.string().min(1).max(128),
  migrationStrategyId: z.string().min(1).max(128),
});
export type LanguageChangeStrategy = z.infer<typeof LanguageChangeStrategySchema>;

/** A common Finding envelope around the existing language-neutral impact evidence. */
export const UnifiedFindingSchema = ImpactFindingSchema.extend({
  provider: z.string().min(1).max(64),
  language: SupportedLanguageSchema,
  packagePath: RepositoryPathSchema.optional(),
});
export type UnifiedFinding = z.infer<typeof UnifiedFindingSchema>;

/** Declarative strategy identity only; execution remains owned by deterministic patch/verification code. */
export const MigrationStrategyDescriptorSchema = z.strictObject({
  id: z.string().min(1).max(128),
  language: SupportedLanguageSchema,
  kind: z.enum(['deterministic-transform', 'manual-review']),
  targetFiles: z.array(RepositoryPathSchema).max(100),
});
export type MigrationStrategyDescriptor = z.infer<typeof MigrationStrategyDescriptorSchema>;

/** LLM output is explicitly a candidate artifact, not verification evidence or authorization. */
export const RegressionTestCandidateSchema = z.strictObject({
  id: z.string().min(1).max(128),
  status: z.literal('candidate'),
  language: SupportedLanguageSchema,
  path: RepositoryPathSchema,
  content: z.string().max(200_000),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  targetFiles: z.array(RepositoryPathSchema).min(1).max(100),
  generatedBy: z.literal('llm'),
});
export type RegressionTestCandidate = z.infer<typeof RegressionTestCandidateSchema>;

/** Adapter-level usage retains common source coordinates and language-specific syntax context. */
export const LanguageApiUsageSchema = z.strictObject({
  provider: z.string().min(1).max(64),
  language: SupportedLanguageSchema,
  packagePath: z.string().min(1).max(500).optional(),
  symbol: z.string().min(1).max(300),
  syntaxKind: z.string().min(1).max(100),
  location: LocationSchema,
  context: z.string().max(12_000),
});
export type LanguageApiUsage = z.infer<typeof LanguageApiUsageSchema>;
