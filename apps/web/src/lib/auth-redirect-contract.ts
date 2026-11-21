/**
 * Keeps post-authentication redirects on a same-origin application path.
 * The middleware historically used `from`, while OAuth and invitation flows
 * use `next`; accepting both preserves the complete return path safely.
 */
export function safeNextPath(value: string | null, origin: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  try {
    const parsed = new URL(value, origin);
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export function loginDestination(search: string, origin: string): string {
  const params = new URLSearchParams(search);
  return safeNextPath(params.get('next') ?? params.get('from'), origin);
}
