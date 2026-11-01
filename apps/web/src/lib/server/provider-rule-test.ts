export type ProviderRuleTestMatch = { token: string; line: number; snippet: string };

const TOKEN_FIELDS = [
  'apiOperationPatterns',
  'affectedModels',
  'affectedEndpoints',
  'affectedParameters',
  'affectedResponseFields',
  'affectedDomains',
  'affectedResources',
  'authOrHeaderPatterns',
] as const;

/** Extracts only bounded, source-derived tokens for the review preview. */
export function collectProviderRuleTestTokens(payload: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const key of TOKEN_FIELDS) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim().length > 0 && item.length <= 200) values.push(item.trim());
      }
    }
  }
  const apiVersionMetadata = payload.apiVersionMetadata;
  if (apiVersionMetadata && typeof apiVersionMetadata === 'object' && !Array.isArray(apiVersionMetadata)) {
    for (const key of ['version', 'replacement']) {
      const value = (apiVersionMetadata as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim().length > 0 && value.length <= 200) values.push(value.trim());
    }
  }
  const enumMetadata = payload.enumMetadata;
  if (enumMetadata && typeof enumMetadata === 'object' && !Array.isArray(enumMetadata)) {
    const removedValues = (enumMetadata as Record<string, unknown>).removedValues;
    if (Array.isArray(removedValues)) {
      for (const value of removedValues) if (typeof value === 'string' && value.trim().length > 0 && value.length <= 200) values.push(value.trim());
    }
  }
  return [...new Set(values)].slice(0, 100);
}

/** Performs a literal, line-aware preview; it never executes submitted code. */
export function findProviderRuleTestMatches(code: string, tokens: readonly string[]): ProviderRuleTestMatch[] {
  const matches: ProviderRuleTestMatch[] = [];
  const lines = code.split(/\r?\n/);
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'g');
    lines.forEach((line, index) => {
      if (matcher.test(line)) matches.push({ token, line: index + 1, snippet: line.trim().slice(0, 500) });
      matcher.lastIndex = 0;
    });
  }
  return matches.slice(0, 100);
}
