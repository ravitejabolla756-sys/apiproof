function parseConfiguredOrigin(value: string, isProduction: boolean): URL | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && isProduction) return null;
    return new URL(`${url.protocol}//${url.host}`);
  } catch {
    return null;
  }
}

/** Returns a credential-free origin suitable for public metadata URLs. */
export function publicSiteOrigin(environment: NodeJS.ProcessEnv = process.env): URL {
  for (const candidate of [environment.NEXT_PUBLIC_APP_URL, environment.APIPROOF_APP_URL]) {
    const configured = candidate?.trim();
    if (configured) {
      const origin = parseConfiguredOrigin(configured, environment.NODE_ENV === 'production');
      if (origin) return origin;
    }
  }
  return new URL('https://myowl.dev');
}
