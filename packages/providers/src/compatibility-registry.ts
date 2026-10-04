import semver from 'semver';
import { ReviewedCompatibilityChangeSchema } from '@apiproof/shared';
import type { ReviewedCompatibilityChange } from '@apiproof/shared';
import { DISCOVERY_PROVIDERS } from './discovery-registry.js';

export interface ProductionChangeRegistry {
  readonly changes: readonly ReviewedCompatibilityChange[];
  readonly byProvider: ReadonlyMap<string, readonly ReviewedCompatibilityChange[]>;
  readonly byPackage: ReadonlyMap<string, readonly ReviewedCompatibilityChange[]>;
  readonly byOperation: ReadonlyMap<string, readonly ReviewedCompatibilityChange[]>;
  readonly byChangeId: ReadonlyMap<string, ReviewedCompatibilityChange>;
}

const sortChanges = (changes: ReviewedCompatibilityChange[]): ReviewedCompatibilityChange[] =>
  changes.sort((a, b) => a.changeId.localeCompare(b.changeId, 'en'));

/**
 * Compiles only production-safe records. Synthetic fixtures belong under tests/
 * and are rejected at this boundary even when their shape is otherwise valid.
 */
export function compileProductionChangeRegistry(inputs: readonly unknown[], providerIds: readonly string[] = DISCOVERY_PROVIDERS.map((provider) => provider.id)): ProductionChangeRegistry {
  const allowedProviders = new Set(providerIds);
  const parsed = inputs.map((input) => ReviewedCompatibilityChangeSchema.parse(input));
  const byChangeId = new Map<string, ReviewedCompatibilityChange>();
  for (const change of parsed) {
    if (!allowedProviders.has(change.providerId)) throw new Error(`COMPATIBILITY_UNKNOWN_PROVIDER:${change.providerId}`);
    if (byChangeId.has(change.changeId)) throw new Error(`COMPATIBILITY_DUPLICATE_CHANGE_ID:${change.changeId}`);
    if (change.review.provenance !== 'official') throw new Error(`COMPATIBILITY_NON_OFFICIAL_RECORD:${change.changeId}`);
    if (change.review.status !== 'reviewed') throw new Error(`COMPATIBILITY_UNREVIEWED_RECORD:${change.changeId}`);
    if (change.affectedVersionRange && !semver.validRange(change.affectedVersionRange)) throw new Error(`COMPATIBILITY_INVALID_VERSION_RANGE:${change.changeId}`);
    if (!change.evidence.some((source) => source.url === change.officialSourceUrl)) throw new Error(`COMPATIBILITY_SOURCE_NOT_IN_EVIDENCE:${change.changeId}`);
    byChangeId.set(change.changeId, change);
  }
  const byProvider = new Map<string, ReviewedCompatibilityChange[]>();
  const byPackage = new Map<string, ReviewedCompatibilityChange[]>();
  const byOperation = new Map<string, ReviewedCompatibilityChange[]>();
  const add = (map: Map<string, ReviewedCompatibilityChange[]>, key: string, change: ReviewedCompatibilityChange): void => {
    const list = map.get(key) ?? [];
    list.push(change); map.set(key, list);
  };
  for (const change of parsed) {
    add(byProvider, change.providerId, change);
    for (const packageName of change.affectedPackages) add(byPackage, packageName, change);
    for (const operation of change.apiOperationPatterns) add(byOperation, operation, change);
  }
  for (const map of [byProvider, byPackage, byOperation]) for (const [key, list] of map) map.set(key, sortChanges(list));
  return { changes: sortChanges([...parsed]), byProvider, byPackage, byOperation, byChangeId };
}

/** No production records are asserted until manual source review supplies them. */
export const PRODUCTION_COMPATIBILITY_REGISTRY = compileProductionChangeRegistry([]);
