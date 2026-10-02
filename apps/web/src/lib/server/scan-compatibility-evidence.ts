import type { ScanResult } from '@apiproof/shared';

export interface ScanCompatibilityProviderEvidence {
  provider: 'stripe' | 'twilio';
  detected: boolean;
  usageCount: number;
  mappedSymbolCount: number;
}

export interface ScanCompatibilityEvidence {
  schemaVersion: 1;
  providers: ScanCompatibilityProviderEvidence[];
}

/** Persist only aggregate analyzer evidence; never store source snippets or argument values here. */
export function summarizeScanCompatibility(results: ScanResult[]): ScanCompatibilityEvidence {
  return {
    schemaVersion: 1,
    providers: results.map((result) => {
      if (result.provider !== 'stripe' && result.provider !== 'twilio') {
        throw new Error(`Unsupported compatibility provider in scan result: ${result.provider}`);
      }

      const mappedSymbols = new Set(
        result.usages
          .filter((usage) => usage.kind !== 'import' && Boolean(usage.evidence.binding))
          .map((usage) => usage.symbol)
      );

      return {
        provider: result.provider,
        detected: result.providerUsed,
        usageCount: result.usages.length,
        mappedSymbolCount: mappedSymbols.size,
      };
    }),
  };
}

export function parseScanCompatibilityEvidence(raw: string | null | undefined): ScanCompatibilityEvidence | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<ScanCompatibilityEvidence>;
    if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.providers)) return null;

    for (const provider of candidate.providers) {
      if (!provider || typeof provider !== 'object') return null;
      if (provider.provider !== 'stripe' && provider.provider !== 'twilio') return null;
      if (typeof provider.detected !== 'boolean') return null;
      if (!Number.isInteger(provider.usageCount) || provider.usageCount < 0) return null;
      if (!Number.isInteger(provider.mappedSymbolCount) || provider.mappedSymbolCount < 0) return null;
    }

    return candidate as ScanCompatibilityEvidence;
  } catch {
    return null;
  }
}
