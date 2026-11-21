export interface InventoryRule {
  id: string;
  title: string;
  severity: string;
  description: string;
}

export interface ProviderInventoryItem {
  id: string;
  name: string;
  category: string;
  status: 'reviewed' | 'detected';
  rulesCount: number;
  description: string;
  rules: InventoryRule[];
  capability?: 'discovery' | 'compatibility';
  capabilities?: string[];
}

const MAX_PROVIDERS = 1024;
const MAX_RULES_PER_PROVIDER = 2048;
const MAX_CAPABILITIES = 32;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function parseRule(value: unknown): InventoryRule | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 128);
  const title = text(row.title, 256);
  const severity = text(row.severity, 64);
  const description = text(row.description, 2000);
  return id && title && severity && description ? { id, title, severity, description } : undefined;
}

function parseProvider(value: unknown): ProviderInventoryItem | undefined {
  const row = record(value);
  if (!row || !Array.isArray(row.rules) || row.rules.length > MAX_RULES_PER_PROVIDER) return undefined;

  const id = text(row.id, 128);
  const name = text(row.name, 256);
  const category = text(row.category, 128);
  const description = text(row.description, 2000);
  const status = row.status === 'reviewed' || row.status === 'detected' ? row.status : undefined;
  const rulesCount = row.rulesCount;
  const rules = row.rules.map(parseRule);
  if (!id || !name || !category || !description || !status || !Number.isSafeInteger(rulesCount) || rulesCount !== rules.length || rules.some((rule) => !rule)) {
    return undefined;
  }

  const rawCapabilities = row.capabilities;
  const capabilities = rawCapabilities === undefined
    ? undefined
    : Array.isArray(rawCapabilities) && rawCapabilities.length <= MAX_CAPABILITIES
      ? rawCapabilities.map((item) => text(item, 64)).filter((item): item is string => Boolean(item))
      : undefined;
  if (rawCapabilities !== undefined && (!capabilities || !Array.isArray(rawCapabilities) || capabilities.length !== rawCapabilities.length)) return undefined;

  const capability = row.capability === undefined
    ? undefined
    : row.capability === 'discovery' || row.capability === 'compatibility' ? row.capability : null;
  if (capability === null) return undefined;

  return {
    id,
    name,
    category,
    status,
    rulesCount,
    description,
    rules: rules as InventoryRule[],
    ...(capability ? { capability } : {}),
    ...(capabilities ? { capabilities } : {}),
  };
}

export function parseInventoryResponse(value: unknown): ProviderInventoryItem[] | undefined {
  const payload = record(value);
  if (!payload || !Array.isArray(payload.providers) || payload.providers.length > MAX_PROVIDERS) return undefined;
  const providers = payload.providers.map(parseProvider);
  return providers.every((provider): provider is ProviderInventoryItem => Boolean(provider)) ? providers : undefined;
}
