import type { ProviderDiscoveryResult } from '@apiproof/analyzers';
import type { NormalizedUsageIR } from '@apiproof/shared';
import type { ScanCompatibilityEvidence } from './scan-compatibility-evidence.js';

const MAX_EVIDENCE = 5_000;

/** Preserve the v1 compatibility envelope while adding bounded, non-secret discovery evidence. */
export function scanResultWithDiscovery(
  compatibility: ScanCompatibilityEvidence, providers: ProviderDiscoveryResult[], usageIR: readonly NormalizedUsageIR[] = [],
): ScanCompatibilityEvidence & { discovery: { schemaVersion: 1; providers: ProviderDiscoveryResult[]; truncated: boolean }; usageIR: NormalizedUsageIR[]; usageIRTruncated: boolean } {
  let remaining = MAX_EVIDENCE;
  let truncated = false;
  const bounded = providers.map((provider) => {
    const evidence = provider.evidence.slice(0, remaining);
    remaining -= evidence.length;
    if (evidence.length < provider.evidence.length) truncated = true;
    return { ...provider, evidence,
      detectionKind: [...new Set(evidence.map((item) => item.detectionKind))],
      files: [...new Set(evidence.map((item) => item.file))],
      locations: evidence.map(({ file, line, column }) => ({ file, line, column })),
      apiDomains: [...new Set(evidence.flatMap((item) => item.apiDomain ? [item.apiDomain] : []))] };
  });
  const orderedUsageIR = [...usageIR].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const boundedUsageIR = orderedUsageIR.slice(0, MAX_EVIDENCE);
  return { ...compatibility, discovery: { schemaVersion: 1, providers: bounded, truncated }, usageIR: boundedUsageIR, usageIRTruncated: boundedUsageIR.length < orderedUsageIR.length };
}
