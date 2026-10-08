import type { HeaderEvidence } from '@apiproof/shared';

export interface ApiVersionEvidence {
  apiVersion?: string;
  dynamic: boolean;
}

export function hostnameFromHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.hostname.toLowerCase().replace(/\.$/, '') || undefined;
  } catch {
    return undefined;
  }
}

export function matchesProviderDomain(value: string, domains: readonly string[]): boolean {
  const hostname = hostnameFromHttpUrl(value);
  if (!hostname) return false;
  return domains.some((domain) => {
    const normalized = domain.toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

export function resolveApiVersion(headers: readonly HeaderEvidence[], authoritativeNames: readonly string[]): ApiVersionEvidence {
  const names = new Set(authoritativeNames.map((name) => name.toLowerCase()));
  const relevant = headers.filter((header) => names.has(header.name.toLowerCase()));
  if (relevant.length === 0) return { dynamic: false };
  if (relevant.some((header) => !header.static)) return { dynamic: true };
  const values = [...new Set(relevant.map((header) => header.value).filter((value): value is string => Boolean(value)))];
  return values.length === 1 && relevant.every((header) => header.value === values[0])
    ? { ...(values[0] ? { apiVersion: values[0] } : {}), dynamic: false }
    : { dynamic: true };
}

export function isSensitiveHeaderName(name: string): boolean {
  return /authorization|cookie|token|secret|api[-_]?key|credential|password/i.test(name);
}
