const DEFAULT_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-CSRF-Token',
  'X-GitHub-Event',
  'X-Hub-Signature-256',
  'X-Billing-Signature',
].join(', ');

export interface SecurityHeaderOptions {
  isHttps: boolean;
  isDevelopment?: boolean;
  isApiRequest?: boolean;
  origin?: string | null;
  configuredCorsOrigins?: readonly string[];
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || (url.pathname !== '/' && url.pathname !== '')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function readConfiguredCorsOrigins(value = process.env.APIPROOF_CORS_ORIGINS): string[] {
  return (value ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null);
}

export function resolveCorsOrigin(
  origin: string | null | undefined,
  configuredOrigins: readonly string[] = readConfiguredCorsOrigins(),
): string | null {
  if (!origin) return null;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return null;

  const normalizedConfiguredOrigins = configuredOrigins
    .map(normalizeOrigin)
    .filter((configuredOrigin): configuredOrigin is string => configuredOrigin !== null);

  return normalizedConfiguredOrigins.includes(normalizedOrigin) ? normalizedOrigin : null;
}

function buildContentSecurityPolicy(isDevelopment: boolean): string {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.github.com https://github.com https://accounts.google.com https://oauth2.googleapis.com https://slack.com",
    "frame-src 'self' https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): Headers {
  const headers = new Headers({
    'Content-Security-Policy': buildContentSecurityPolicy(options.isDevelopment ?? false),
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });

  if (options.isHttps) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (options.isApiRequest) {
    const corsOrigin = resolveCorsOrigin(options.origin, options.configuredCorsOrigins);
    headers.set('Vary', 'Origin');
    if (corsOrigin) {
      headers.set('Access-Control-Allow-Origin', corsOrigin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', DEFAULT_ALLOWED_METHODS);
      headers.set('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS);
      headers.set('Access-Control-Max-Age', '600');
    }
  }

  return headers;
}

export function applySecurityHeaders(response: Response, options: SecurityHeaderOptions): Response {
  const headers = buildSecurityHeaders(options);
  headers.forEach((value, key) => {
    if (key === 'vary' && response.headers.has('Vary')) {
      const current = response.headers.get('Vary');
      if (current && !current.split(',').some((entry) => entry.trim().toLowerCase() === 'origin')) {
        response.headers.set('Vary', `${current}, Origin`);
      }
      return;
    }
    response.headers.set(key, value);
  });
  return response;
}

export const securityHeaderConstants = {
  allowedMethods: DEFAULT_ALLOWED_METHODS,
  allowedHeaders: DEFAULT_ALLOWED_HEADERS,
} as const;
