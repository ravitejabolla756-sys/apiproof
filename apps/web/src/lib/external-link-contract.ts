/**
 * Keep backend-provided external links inert unless they are absolute,
 * credential-free HTTPS URLs. Provider host allowlisting remains a shared
 * contract decision and is intentionally not inferred here.
 */
export function toSafeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Keep client-side redirects on a same-origin path or a credential-free HTTPS URL. */
export function toSafeNavigationUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
    try {
      const parsed = new URL(value, 'https://my-owl.invalid');
      return parsed.origin === 'https://my-owl.invalid' ? value : null;
    } catch {
      return null;
    }
  }
  return toSafeExternalUrl(value);
}

/** Validate the manual-copy invitation response against the current origin and route. */
export function toSafeInvitationUrl(value: string | null | undefined, origin: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value, origin);
    const expected = new URL(origin);
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    const equivalentLoopback = loopbackHosts.has(parsed.hostname) && loopbackHosts.has(expected.hostname)
      && parsed.protocol === expected.protocol && parsed.port === expected.port;
    if (parsed.origin !== expected.origin && !equivalentLoopback) return null;
    const tokens = parsed.searchParams.getAll('token');
    if (parsed.pathname !== '/invite/accept' || tokens.length !== 1 || !tokens[0]?.trim()) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
