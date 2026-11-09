export type CommandPaletteProjection = {
  repositories: Array<{
    id: string;
    name: string;
    full_name: string;
    status: string;
    findings_count: number;
  }>;
  providers: Array<{
    id: string;
    name: string;
    category: string;
    rulesCount: number;
  }>;
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

/** Validate the minimal server-owned collections used by command-palette search. */
export function parseCommandPaletteResponse(value: unknown): CommandPaletteProjection | null {
  if (!record(value) || !Array.isArray(value.repositories) || !Array.isArray(value.providers)) return null;
  const repositoryIds = new Set<string>();
  const repositories: CommandPaletteProjection['repositories'] = [];
  for (const item of value.repositories) {
    if (!record(item) || !text(item.id) || !text(item.name) || !text(item.full_name) || !text(item.status) || !count(item.findings_count) || repositoryIds.has(item.id)) return null;
    repositoryIds.add(item.id);
    repositories.push({ id: item.id, name: item.name, full_name: item.full_name, status: item.status, findings_count: item.findings_count });
  }

  const providerIds = new Set<string>();
  const providers: CommandPaletteProjection['providers'] = [];
  for (const item of value.providers) {
    if (!record(item) || !text(item.id) || !text(item.name) || !text(item.category) || !count(item.rulesCount) || providerIds.has(item.id)) return null;
    providerIds.add(item.id);
    providers.push({ id: item.id, name: item.name, category: item.category, rulesCount: item.rulesCount });
  }
  return { repositories, providers };
}
