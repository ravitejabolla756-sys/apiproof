import { z } from 'zod';
import { CompatibilityResultSchema } from './compatibility.js';
import { NormalizedUsageIRSchema } from './usage-ir.js';

const RepositoryPathSchema = z.string().min(1).refine((value) => !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..'), 'Repository paths must be relative and normalized.');
const DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const UsageGraphFileSchema = z.strictObject({
  path: RepositoryPathSchema,
  digest: DigestSchema,
  kind: z.enum(['source', 'manifest', 'lockfile', 'configuration']),
});
export type UsageGraphFile = z.infer<typeof UsageGraphFileSchema>;

export const UsageGraphUsageSchema = z.strictObject({
  usageId: z.string().min(1),
  file: RepositoryPathSchema,
  providerId: z.string().min(1),
  packageName: z.string().min(1).nullable(),
  operation: z.string().nullable(),
  symbol: z.string().nullable(),
  resolvedVersion: z.string().nullable(),
});
export type UsageGraphUsage = z.infer<typeof UsageGraphUsageSchema>;

export const UsageGraphChangeSchema = z.strictObject({
  changeId: z.string().min(1),
  providerId: z.string().min(1),
  usageIds: z.array(z.string().min(1)),
  resultIds: z.array(z.string().min(1)),
});
export type UsageGraphChange = z.infer<typeof UsageGraphChangeSchema>;

export const RepositoryUsageGraphSchema = z.strictObject({
  repositoryId: z.string().min(1),
  baselineSha: DigestSchema,
  files: z.array(UsageGraphFileSchema),
  usages: z.array(UsageGraphUsageSchema),
  changes: z.array(UsageGraphChangeSchema),
  compatibilityResults: z.array(CompatibilityResultSchema),
});
export type RepositoryUsageGraph = z.infer<typeof RepositoryUsageGraphSchema>;

export interface RepositoryUsageGraphIndex {
  readonly byFile: ReadonlyMap<string, readonly string[]>;
  readonly byProvider: ReadonlyMap<string, readonly string[]>;
  readonly byPackage: ReadonlyMap<string, readonly string[]>;
  readonly byUsageId: ReadonlyMap<string, UsageGraphUsage>;
  readonly changeIdsByUsageId: ReadonlyMap<string, readonly string[]>;
  readonly changeIdsByProvider: ReadonlyMap<string, readonly string[]>;
}

export interface IncrementalLookupComplexity {
  readonly strategy: 'indexed';
  readonly usageNodes: number;
  readonly changeNodes: number;
  readonly changedInputs: number;
  readonly candidateUsageNodes: number;
  readonly candidateChangeNodes: number;
  readonly indexedLookups: number;
  readonly naiveProviderComparisons: number;
}

export const IncrementalAnalysisPlanSchema = z.strictObject({
  repositoryId: z.string().min(1),
  baselineSha: DigestSchema,
  changedFiles: z.array(RepositoryPathSchema),
  changedDependencyPackages: z.array(z.string().min(1)),
  changedProviderIds: z.array(z.string().min(1)),
  reanalyzeFiles: z.array(RepositoryPathSchema),
  impactedUsageIds: z.array(z.string().min(1)),
  reevaluateChangeIds: z.array(z.string().min(1)),
  reusableChangeIds: z.array(z.string().min(1)),
  reasonCodes: z.array(z.string()).min(1),
});
export type IncrementalAnalysisPlan = z.infer<typeof IncrementalAnalysisPlanSchema>;

export type IncrementalPlanInput = {
  graph: unknown;
  changedFiles: readonly string[];
  changedDependencyPackages?: readonly string[];
  changedProviderIds?: readonly string[];
  index?: RepositoryUsageGraphIndex;
};

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));

const addToIndex = (index: Map<string, string[]>, key: string, value: string): void => {
  const values = index.get(key) ?? [];
  if (!values.includes(value)) values.push(value);
  index.set(key, values);
};

const freezeIndex = (index: Map<string, string[]>): ReadonlyMap<string, readonly string[]> =>
  new Map([...index.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, values]) => [key, sortedUnique(values)]));

/** Builds the reusable graph indexes used by incremental planning. */
export function buildRepositoryUsageGraphIndex(graphInput: unknown): RepositoryUsageGraphIndex {
  const graph = RepositoryUsageGraphSchema.parse(graphInput);
  const byFile = new Map<string, string[]>();
  const byProvider = new Map<string, string[]>();
  const byPackage = new Map<string, string[]>();
  const byUsageId = new Map<string, UsageGraphUsage>();
  const changeIdsByUsageId = new Map<string, string[]>();
  const changeIdsByProvider = new Map<string, string[]>();
  for (const usage of graph.usages) {
    byUsageId.set(usage.usageId, usage);
    addToIndex(byFile, usage.file, usage.usageId);
    addToIndex(byProvider, usage.providerId, usage.usageId);
    if (usage.packageName) addToIndex(byPackage, usage.packageName, usage.usageId);
  }
  for (const change of graph.changes) {
    addToIndex(changeIdsByProvider, change.providerId, change.changeId);
    for (const usageId of change.usageIds) addToIndex(changeIdsByUsageId, usageId, change.changeId);
  }
  return { byFile: freezeIndex(byFile), byProvider: freezeIndex(byProvider), byPackage: freezeIndex(byPackage), byUsageId,
    changeIdsByUsageId: freezeIndex(changeIdsByUsageId), changeIdsByProvider: freezeIndex(changeIdsByProvider) };
}

const unionIndexValues = (index: ReadonlyMap<string, readonly string[]>, keys: readonly string[]): string[] => {
  const values = new Set<string>();
  for (const key of keys) for (const value of index.get(key) ?? []) values.add(value);
  return [...values].sort((a, b) => a.localeCompare(b, 'en'));
};

/** Reports deterministic indexed-vs-naive work estimates for capacity testing. */
export function summarizeIncrementalLookupComplexity(
  graphInput: unknown,
  input: Pick<IncrementalPlanInput, 'changedFiles' | 'changedDependencyPackages' | 'changedProviderIds'>,
  index?: RepositoryUsageGraphIndex,
): IncrementalLookupComplexity {
  const graph = RepositoryUsageGraphSchema.parse(graphInput);
  const resolvedIndex = index ?? buildRepositoryUsageGraphIndex(graph);
  const changedFiles = sortedUnique(input.changedFiles);
  const changedPackages = sortedUnique(input.changedDependencyPackages ?? []);
  const changedProviders = sortedUnique(input.changedProviderIds ?? []);
  const candidateUsageIds = new Set([
    ...unionIndexValues(resolvedIndex.byFile, changedFiles),
    ...unionIndexValues(resolvedIndex.byPackage, changedPackages),
    ...unionIndexValues(resolvedIndex.byProvider, changedProviders),
  ]);
  const candidateChangeIds = new Set([
    ...unionIndexValues(resolvedIndex.changeIdsByProvider, changedProviders),
    ...[...candidateUsageIds].flatMap((usageId) => resolvedIndex.changeIdsByUsageId.get(usageId) ?? []),
  ]);
  return { strategy: 'indexed', usageNodes: graph.usages.length, changeNodes: graph.changes.length,
    changedInputs: changedFiles.length + changedPackages.length + changedProviders.length,
    candidateUsageNodes: candidateUsageIds.size, candidateChangeNodes: candidateChangeIds.size,
    indexedLookups: changedFiles.length + changedPackages.length + changedProviders.length,
    naiveProviderComparisons: graph.usages.length * Math.max(1, changedProviders.length) };
}

/**
 * Builds the language-neutral graph from normalized usage IR and existing
 * proofs. It is an indexable snapshot, not a second source of provider rules.
 */
export function buildRepositoryUsageGraph(input: {
  repositoryId: string;
  baselineSha: string;
  files: readonly unknown[];
  usageIR: readonly unknown[];
  compatibilityResults?: readonly unknown[];
}): RepositoryUsageGraph {
  const files = input.files.map((file) => UsageGraphFileSchema.parse(file));
  const usagesIR = input.usageIR.map((usage) => NormalizedUsageIRSchema.parse(usage));
  const usages = usagesIR.map((usage): UsageGraphUsage => ({
    usageId: usage.id,
    file: usage.location.file,
    providerId: usage.providerId,
    packageName: usage.packageName ?? null,
    operation: usage.operation ?? null,
    symbol: usage.location.symbol ?? null,
    resolvedVersion: usage.resolvedVersion,
  }));
  const usageIds = new Set<string>();
  for (const usage of usages) {
    if (usageIds.has(usage.usageId)) throw new Error(`USAGE_GRAPH_DUPLICATE_USAGE_ID:${usage.usageId}`);
    usageIds.add(usage.usageId);
  }
  const compatibilityResults = (input.compatibilityResults ?? []).map((result) => CompatibilityResultSchema.parse(result));
  const resultIds = compatibilityResults.map((result) => `${result.providerId}:${result.changeId}:${result.exactFile ?? ''}:${result.exactLine ?? ''}`);
  const changes = new Map<string, UsageGraphChange>();
  compatibilityResults.forEach((result, index) => {
    const key = `${result.providerId}:${result.changeId}`;
    const current = changes.get(key) ?? { changeId: result.changeId, providerId: result.providerId, usageIds: [], resultIds: [] };
    current.usageIds.push(...result.matchedUsages.map((usage) => usage.id));
    current.resultIds.push(resultIds[index] ?? `${result.providerId}:${result.changeId}:${result.exactFile ?? ''}:${result.exactLine ?? ''}`);
    changes.set(key, current);
  });
  return RepositoryUsageGraphSchema.parse({
    repositoryId: input.repositoryId,
    baselineSha: input.baselineSha,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path, 'en')),
    usages: [...usages].sort((a, b) => a.usageId.localeCompare(b.usageId, 'en')),
    changes: [...changes.values()].map((change) => ({ ...change, usageIds: sortedUnique(change.usageIds), resultIds: sortedUnique(change.resultIds) })).sort((a, b) => `${a.providerId}:${a.changeId}`.localeCompare(`${b.providerId}:${b.changeId}`, 'en')),
    compatibilityResults,
  });
}

/**
 * Selects only graph nodes whose evidence can be affected by a file,
 * dependency, or provider/configuration change. Baseline identity is retained
 * so callers cannot accidentally reuse a plan for a different repository HEAD.
 */
export function planIncrementalAnalysis(input: IncrementalPlanInput): IncrementalAnalysisPlan {
  const graph = RepositoryUsageGraphSchema.parse(input.graph);
  const index = input.index ?? buildRepositoryUsageGraphIndex(graph);
  const changedFiles = sortedUnique(input.changedFiles);
  const changedDependencyPackages = sortedUnique(input.changedDependencyPackages ?? []);
  const changedProviderIds = sortedUnique(input.changedProviderIds ?? []);
  const impactedUsageIds = unionIndexValues(index.byFile, changedFiles).concat(
    unionIndexValues(index.byPackage, changedDependencyPackages),
    unionIndexValues(index.byProvider, changedProviderIds),
  ).filter((usageId, position, values) => values.indexOf(usageId) === position);
  const reanalyzeFiles = impactedUsageIds.map((usageId) => index.byUsageId.get(usageId)?.file).filter((file): file is string => Boolean(file));
  const reevaluateChangeIds = [...new Set([
    ...unionIndexValues(index.changeIdsByProvider, changedProviderIds),
    ...impactedUsageIds.flatMap((usageId) => index.changeIdsByUsageId.get(usageId) ?? []),
  ])];
  const reevaluateSet = new Set(reevaluateChangeIds);
  const reusableChangeIds = graph.changes.filter((change) => !reevaluateSet.has(change.changeId)).map((change) => change.changeId);
  const reasonCodes: string[] = [];
  if (changedFiles.length) reasonCodes.push('CHANGED_FILES');
  if (changedDependencyPackages.length) reasonCodes.push('CHANGED_DEPENDENCY_STATE');
  if (changedProviderIds.length) reasonCodes.push('CHANGED_PROVIDER_STATE');
  if (!reasonCodes.length) reasonCodes.push('NO_CHANGE_INPUTS');
  if (!impactedUsageIds.length) reasonCodes.push('NO_IMPACTED_USAGE_NODES');
  return IncrementalAnalysisPlanSchema.parse({
    repositoryId: graph.repositoryId,
    baselineSha: graph.baselineSha,
    changedFiles,
    changedDependencyPackages,
    changedProviderIds,
    reanalyzeFiles: sortedUnique(reanalyzeFiles),
    impactedUsageIds: sortedUnique(impactedUsageIds),
    reevaluateChangeIds: sortedUnique(reevaluateChangeIds),
    reusableChangeIds: sortedUnique(reusableChangeIds),
    reasonCodes,
  });
}
