/**
 * Extracts an API version only when source names an API-version/header field
 * next to the usage. Package versions, filenames, and generic `version`
 * properties are intentionally ignored because they are not API-version proof.
 */
export function extractExplicitApiVersion(content: string, offset: number, lineRadius = 4): string | undefined {
  const lines = content.split(/\r?\n/);
  const lineIndex = content.slice(0, Math.max(0, offset)).split(/\r?\n/).length - 1;
  const start = Math.max(0, lineIndex - lineRadius);
  const end = Math.min(lines.length, lineIndex + lineRadius + 1);
  const window = lines.slice(start, end).join('\n');
  const key = '(?:apiVersion|api_version|api-version|Stripe-Version|stripe_version|X-Api-Version|X-API-Version)';
  const value = '(20\\d{2}[-_]\\d{2}[-_]\\d{2}(?:[._-][A-Za-z0-9]+)?|v\\d+(?:\\.\\d+){0,2})';
  const match = window.match(new RegExp(`(?:${key})\\s*['"]?\\s*[:=]\\s*['"]${value}['"]`, 'i'));
  return match?.[1];
}
