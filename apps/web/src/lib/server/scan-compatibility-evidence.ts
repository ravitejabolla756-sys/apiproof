import { NormalizedUsageIRSchema } from '@apiproof/shared';
import type { NormalizedUsageIR, ScanResult } from '@apiproof/shared';

export interface ScanCompatibilityProviderEvidence {
  /**
   * Provider IDs are intentionally data-driven. The compatibility proof API
   * must represent every monitored provider, not only the two providers that
   * existed when this projection was first introduced.
   */
  provider: string;
  detected: boolean;
  usageCount: number;
  mappedSymbolCount: number;
}

const PROVIDER_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function isProviderId(value: unknown): value is string {
  return typeof value === 'string' && PROVIDER_ID_RE.test(value);
}

export interface ScanCompatibilityEvidence {
  schemaVersion: 1;
  providers: ScanCompatibilityProviderEvidence[];
}

export interface ScanDiscoveryProviderEvidence {
  providerId: string;
  providerName: string;
  packageName: string | null;
  declaredVersion: string | null;
  resolvedVersion: string | null;
  versionSource: string;
  versionConfidence: string;
  capability: string;
  capabilities: string[];
  category: string;
  detectionKinds: string[];
  files: string[];
  apiDomains: string[];
  evidenceCount: number;
}

export interface ScanDiscoveryEvidence {
  schemaVersion: 1;
  providers: ScanDiscoveryProviderEvidence[];
  truncated: boolean;
}

/** Persist only aggregate analyzer evidence; never store source snippets or argument values here. */
export function summarizeScanCompatibility(results: ScanResult[]): ScanCompatibilityEvidence {
  return {
    schemaVersion: 1,
    providers: results.map((result) => {
      if (!isProviderId(result.provider)) {
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
      if (!isProviderId(provider.provider)) return null;
      if (typeof provider.detected !== 'boolean') return null;
      if (!Number.isInteger(provider.usageCount) || provider.usageCount < 0) return null;
      if (!Number.isInteger(provider.mappedSymbolCount) || provider.mappedSymbolCount < 0) return null;
    }

    return candidate as ScanCompatibilityEvidence;
  } catch {
    return null;
  }
}

/** Parses only the bounded, non-secret discovery projection persisted in scan rows. */
export function parseScanDiscoveryEvidence(raw: string | null | undefined): ScanDiscoveryEvidence | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const discovery = (value as Record<string, unknown>).discovery;
    if (!discovery || typeof discovery !== 'object') return null;
    const candidate = discovery as Record<string, unknown>;
    if (candidate.schemaVersion !== 1 || typeof candidate.truncated !== 'boolean' || !Array.isArray(candidate.providers)) return null;
    const providers: ScanDiscoveryProviderEvidence[] = [];
    for (const rawProvider of candidate.providers) {
      if (!rawProvider || typeof rawProvider !== 'object') return null;
      const provider = rawProvider as Record<string, unknown>;
      const text = (key: string): string | null => typeof provider[key] === 'string' && provider[key] ? provider[key] as string : null;
      const list = (key: string): string[] | null => Array.isArray(provider[key]) && provider[key].every((item) => typeof item === 'string') ? [...provider[key] as string[]] : null;
      const providerId = text('providerId');
      const providerName = text('providerName');
      const packageName = provider.packageName === null ? null : text('packageName');
      const declaredVersion = provider.declaredVersion === null ? null : text('declaredVersion');
      const resolvedVersion = provider.resolvedVersion === null ? null : text('resolvedVersion');
      const versionSource = text('versionSource');
      const versionConfidence = text('versionConfidence');
      const capability = text('capability');
      const capabilities = list('capabilities');
      const category = text('category');
      const detectionKinds = list('detectionKind');
      const files = list('files');
      const apiDomains = list('apiDomains');
      const evidence = provider.evidence;
      if (!providerId || !providerName || (provider.packageName !== null && packageName === null)
        || (provider.declaredVersion !== null && declaredVersion === null) || (provider.resolvedVersion !== null && resolvedVersion === null)
        || !versionSource || !versionConfidence || !capability || !capabilities || !category || !detectionKinds || !files || !apiDomains
        || !Array.isArray(evidence) || evidence.length > 5_000) return null;
      providers.push({ providerId, providerName, packageName, declaredVersion, resolvedVersion, versionSource, versionConfidence,
        capability, capabilities, category, detectionKinds, files, apiDomains, evidenceCount: evidence.length });
    }
    return { schemaVersion: 1, providers: providers.sort((a, b) => a.providerId.localeCompare(b.providerId, 'en')), truncated: candidate.truncated };
  } catch {
    return null;
  }
}

/** Parses the bounded normalized usage projection used by proof evaluation. */
export function parseScanUsageIR(raw: string | null | undefined): NormalizedUsageIR[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const usageIR = (value as Record<string, unknown>).usageIR;
    if (!Array.isArray(usageIR) || usageIR.length > 5_000) return null;
    return usageIR.map((usage) => NormalizedUsageIRSchema.parse(usage));
  } catch {
    return null;
  }
}
