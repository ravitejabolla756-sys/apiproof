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
