import type { CandidateChangeRegistry } from './change-ingestion-registry.js';
import type { ProductionChangeRegistry } from './compatibility-registry.js';
import type { ProviderDefinition } from './discovery-registry.js';

export interface ProviderIntelligenceCoverage {
  providerId: string;
  providerName: string;
  discovery: boolean;
  versionAware: boolean;
  candidateChangeCount: number;
  reviewedChangeCount: number;
  migrationCount: number;
  verifiedMigrationCount: number;
}

/** Deterministic local coverage report; it never infers reviewed or migration capability. */
export function buildProviderIntelligenceCoverage(
  providers: readonly ProviderDefinition[],
  candidates: CandidateChangeRegistry,
  reviewed: ProductionChangeRegistry,
): ProviderIntelligenceCoverage[] {
  return providers.map((provider) => ({
    providerId: provider.id,
    providerName: provider.displayName,
    discovery: provider.capabilities.includes('discovery'),
    versionAware: provider.capabilities.includes('versionAware'),
    candidateChangeCount: candidates.byProvider.get(provider.id)?.length ?? 0,
    reviewedChangeCount: reviewed.byProvider.get(provider.id)?.length ?? 0,
    migrationCount: provider.capabilities.includes('migration') ? 1 : 0,
    verifiedMigrationCount: provider.capabilities.includes('verifiedMigration') ? 1 : 0,
  })).sort((a, b) => a.providerId.localeCompare(b.providerId, 'en'));
}
