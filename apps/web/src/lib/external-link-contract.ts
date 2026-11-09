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
