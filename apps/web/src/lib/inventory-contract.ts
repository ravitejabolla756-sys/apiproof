export type ProviderInventoryProjection = {
  id: string;
  name: string;
  category: string;
  status: 'reviewed' | 'detected';
  rulesCount: number;
  description: string;
  rules: Array<{ id: string; title: string; severity: string; description: string }>;
  capability?: 'discovery' | 'compatibility';
  capabilities?: string[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRule(value: unknown): value is ProviderInventoryProjection['rules'][number] {
  return record(value) && text(value.id) && text(value.title) && text(value.severity) && text(value.description);
}

function isProvider(value: unknown): value is ProviderInventoryProjection {
  if (!record(value) || !text(value.id) || !text(value.name) || !text(value.category)
    || (value.status !== 'reviewed' && value.status !== 'detected') || !count(value.rulesCount)
    || !text(value.description) || !Array.isArray(value.rules) || !value.rules.every(isRule)) return false;
  if (value.capability !== undefined && value.capability !== 'discovery' && value.capability !== 'compatibility') return false;
  return value.capabilities === undefined || (Array.isArray(value.capabilities) && value.capabilities.every(text));
}

/** Validate the provider inventory projection before filtering or rendering it. */
export function parseInventoryResponse(value: unknown): ProviderInventoryProjection[] | null {
  if (!record(value) || !Array.isArray(value.providers)) return null;
  const seen = new Set<string>();
  if (!value.providers.every((provider) => {
    if (!isProvider(provider) || seen.has(provider.id)) return false;
    seen.add(provider.id);
    return true;
  })) return null;
  return value.providers;
}
