/**
 * Centralized Production Environment Configuration & Validation Layer.
 *
 * Enforces production readiness invariants:
 * - Fails fast in production if security-critical variables are missing or weak.
 * - Allows mock/test defaults in development and test environments.
 * - Prevents secret values from entering logs or client bundles.
 */

import { getConfiguredFounderUserId, isLiveScanProtectionEnabled } from './founder-scan-authorization.js';

export interface AppEnvConfig {
  nodeEnv: 'production' | 'development' | 'test';
  isProduction: boolean;
  appUrl: string;
  apiproofSecret: string;
  githubAppId: string;
  githubAppSlug: string;
  githubAppPrivateKey: string;
  githubWebhookSecret: string;
  cronSecret: string;
}

export interface ValidationIssue {
  variable: string;
  message: string;
}

export interface EnvValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  config: AppEnvConfig;
}

/**
 * Validates production environment configuration.
 *
 * In production (NODE_ENV === 'production'):
 * - Fails closed if any security-critical secret is missing or invalid.
 * In development or test:
 * - Returns valid with fallback test values if not configured.
 */
export function validateEnvConfig(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const nodeEnv = (env.NODE_ENV ?? 'development').toLowerCase() as 'production' | 'development' | 'test';
  const isProduction = nodeEnv === 'production';
  const issues: ValidationIssue[] = [];

  const appUrl = env.NEXT_PUBLIC_APP_URL || env.APIPROOF_APP_URL || (isProduction ? 'https://myowl.dev' : 'http://localhost:3000');
  const apiproofSecret = env.APIPROOF_SECRET || (isProduction ? '' : 'test-apiproof-secret-32-chars-minimum-length!!');
  const githubAppId = env.GITHUB_APP_ID || (isProduction ? '' : '12345');
  const githubAppSlug = env.GITHUB_APP_SLUG || (isProduction ? '' : 'apiproof-dev');
  const githubAppPrivateKey = env.GITHUB_APP_PRIVATE_KEY || (isProduction ? '' : '-----BEGIN RSA PRIVATE KEY-----\nMIIPlaceholder\n-----END RSA PRIVATE KEY-----');
  const githubWebhookSecret = env.GITHUB_WEBHOOK_SECRET || (isProduction ? '' : 'test-webhook-secret-32-chars-long!');
  const cronSecret = env.CRON_SECRET || (isProduction ? '' : 'test-cron-secret-32-chars-long!');

  if (isProduction) {
    if (!apiproofSecret || apiproofSecret.length < 32) {
      issues.push({ variable: 'APIPROOF_SECRET', message: 'APIPROOF_SECRET must be set and at least 32 characters long in production.' });
    }
    if (!githubAppId || githubAppId.trim().length === 0) {
      issues.push({ variable: 'GITHUB_APP_ID', message: 'GITHUB_APP_ID must be set in production.' });
    }
    if (!githubAppSlug || githubAppSlug.trim().length === 0) {
      issues.push({ variable: 'GITHUB_APP_SLUG', message: 'GITHUB_APP_SLUG must be set in production.' });
    }
    if (!githubAppPrivateKey || !githubAppPrivateKey.includes('PRIVATE KEY')) {
      issues.push({ variable: 'GITHUB_APP_PRIVATE_KEY', message: 'GITHUB_APP_PRIVATE_KEY must contain a valid PEM private key in production.' });
    }
    if (!githubWebhookSecret || githubWebhookSecret.length < 16) {
      issues.push({ variable: 'GITHUB_WEBHOOK_SECRET', message: 'GITHUB_WEBHOOK_SECRET must be set and at least 16 characters long in production.' });
    }
    if (!cronSecret || cronSecret.length < 16) {
      issues.push({ variable: 'CRON_SECRET', message: 'CRON_SECRET must be set and at least 16 characters long in production.' });
    }
    if (!appUrl || appUrl.trim().length === 0) {
      issues.push({ variable: 'NEXT_PUBLIC_APP_URL', message: 'NEXT_PUBLIC_APP_URL or APIPROOF_APP_URL must be set in production.' });
    }
    if (isLiveScanProtectionEnabled(env) && !getConfiguredFounderUserId(env)) {
      issues.push({ variable: 'APIPROOF_FOUNDER_USER_ID', message: 'APIPROOF_FOUNDER_USER_ID must be set to a valid founder user ID when live GitHub scanning is enabled.' });
    }
  }

  const valid = issues.length === 0;

  return {
    valid,
    issues,
    config: {
      nodeEnv,
      isProduction,
      appUrl,
      apiproofSecret,
      githubAppId,
      githubAppSlug,
      githubAppPrivateKey,
      githubWebhookSecret,
      cronSecret,
    },
  };
}

/**
 * Asserts that the environment configuration is valid for production.
 * Throws a sanitized Error (without leaking secret values) if invalid.
 */
export function assertProductionEnv(env: Record<string, string | undefined> = process.env): AppEnvConfig {
  const result = validateEnvConfig(env);
  if (!result.valid) {
    const missingVars = result.issues.map((i) => i.variable).join(', ');
    throw new Error(`CRITICAL_CONFIG_ERROR: Production security requirements failed for variables: [${missingVars}]. Application failing closed.`);
  }
  return result.config;
}
