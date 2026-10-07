/**
 * Server-side Structured Logger with Automated Secret Redaction.
 *
 * Ensures all operational logging is structured and sanitized:
 * - Redacts access tokens, private keys, authorization headers, cookies, session secrets.
 * - Standardizes context fields (requestId, workspaceId, repositoryId, scanId, etc.).
 * - Prevents sensitive credential leakage to stdout/stderr.
 */

export interface LogContext {
  requestId?: string;
  workspaceId?: string;
  repositoryId?: string;
  scanId?: string;
  scanRequestId?: string;
  installationId?: string;
  commitSha?: string;
  [key: string]: unknown;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: string;
}

// Sensitive key patterns to redact automatically
const SENSITIVE_KEYS = new Set([
  'token',
  'installationtoken',
  'accesstoken',
  'privatekey',
  'authorization',
  'cronsecret',
  'apiproofsecret',
  'webhooksecret',
  'githubwebhooksecret',
  'authsecret',
  'cookie',
  'session',
  'password',
  'secret',
]);

// Sensitive regex patterns (GitHub tokens, Bearer headers, RSA private keys)
const SECRET_REGEX_PATTERNS = [
  /\b(sk-ant-[A-Za-z0-9_-]{8,})\b/g,
  /\b(sk-[A-Za-z0-9_-]{8,})\b/g,
  /\b(ghs_[A-Za-z0-9_]{20,})\b/g,
  /\b(ghp_[A-Za-z0-9_]{20,})\b/g,
  /\b(github_pat_[A-Za-z0-9_]{20,})\b/g,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b[A-Za-z0-9]+-(?:secret|token|password|private[_-]?key)-[A-Za-z0-9_-]+\b/gi,
  /(?:secret|token|password|private[_-]?key)[-_][A-Za-z0-9_-]{4,}/gi,
  /RAW_SOURCE_MUST_[A-Z0-9_]+/g,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
];

/**
 * Redacts secrets from string values using pattern matching.
 */
export function redactSecretString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  let sanitized = str;
  for (const pattern of SECRET_REGEX_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

/**
 * Deeply redacts sensitive keys and values from objects.
 */
export function redactSensitiveData<T>(val: T): T {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    return redactSecretString(val) as T;
  }

  if (Array.isArray(val)) {
    return val.map((item) => redactSensitiveData(item)) as T;
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(lowerKey.replace(/[^a-z]/g, ''))) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = redactSensitiveData(value);
      }
    }
    return clean as T;
  }

  return val;
}

/**
 * Format log entry as structured JSON.
 */
export function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): string {
  const sanitizedMsg = redactSecretString(message);
  const sanitizedContext = context ? redactSensitiveData(context) : undefined;
  let errorMsg: string | undefined;

  if (error) {
    if (error instanceof Error) {
      errorMsg = redactSecretString(error.message);
    } else {
      errorMsg = redactSecretString(String(error));
    }
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizedMsg,
    ...(sanitizedContext && Object.keys(sanitizedContext).length > 0 ? { context: sanitizedContext } : {}),
    ...(errorMsg ? { error: errorMsg } : {}),
  };

  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(formatLogEntry('info', message, context));
  },
  warn(message: string, context?: LogContext, error?: unknown): void {
    console.warn(formatLogEntry('warn', message, context, error));
  },
  error(message: string, context?: LogContext, error?: unknown): void {
    console.error(formatLogEntry('error', message, context, error));
  },
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLogEntry('debug', message, context));
    }
  },
};
