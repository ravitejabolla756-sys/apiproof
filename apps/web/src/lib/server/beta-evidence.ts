import fs from 'node:fs';
import path from 'node:path';

export type BetaEvidenceCheck = { status: 'pass'; observedAt: string; reference: string };
export type BetaEvidenceManifest = {
  schemaVersion: 1;
  releaseCommit: string;
  providerRegistryDigest: string;
  generatedAt: string;
  operator: string;
  acceptance: {
    tenantId: string;
    repositoryId: string;
    repositoryFullName: string;
    defaultBranch: string;
    commitSha: string;
    scanId: string;
    findingId: string;
    rescanJobId: string;
    migrationId: string;
    draftPullRequestUrl: string;
    defaultBranchWriteObserved: false;
  };
  checks: Record<'githubOnboarding' | 'exactCommitScan' | 'persistedFinding' | 'approvalTriggeredRescan' | 'draftPullRequest' | 'webhookReplayAndDeduplication' | 'scheduledJobs' | 'productionConfiguration' | 'backupAndRestore' | 'tenantIsolation' | 'billingAndNotifications' | 'rollback', BetaEvidenceCheck>;
};

export type BetaEvidenceValidation =
  | { valid: true; manifest: BetaEvidenceManifest; path: string }
  | { valid: false; path: string; error: string };

export type BetaEvidenceWriteOptions = {
  overwrite?: boolean;
};

const REQUIRED_CHECKS = [
  'githubOnboarding', 'exactCommitScan', 'persistedFinding', 'approvalTriggeredRescan',
  'draftPullRequest', 'webhookReplayAndDeduplication', 'scheduledJobs',
  'productionConfiguration', 'backupAndRestore', 'tenantIsolation',
  'billingAndNotifications', 'rollback',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40,64}$/i.test(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function validateManifest(value: unknown): { manifest?: BetaEvidenceManifest; error?: string } {
  if (!isRecord(value)) return { error: 'Manifest must be a JSON object.' };
  if (!hasOnlyKeys(value, ['schemaVersion', 'releaseCommit', 'providerRegistryDigest', 'generatedAt', 'operator', 'acceptance', 'checks'])) return { error: 'Manifest contains an unsupported field.' };
  if (value.schemaVersion !== 1) return { error: 'schemaVersion must be 1.' };
  if (!isSha(value.releaseCommit)) return { error: 'releaseCommit must be a commit SHA.' };
  if (typeof value.providerRegistryDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(value.providerRegistryDigest)) return { error: 'providerRegistryDigest must be a SHA-256 digest.' };
  if (!isTimestamp(value.generatedAt) || !isNonEmptyString(value.operator)) return { error: 'generatedAt and operator are required.' };
  const acceptance = value.acceptance;
  if (!isRecord(acceptance)) return { error: 'acceptance is required.' };
  if (!hasOnlyKeys(acceptance, ['tenantId', 'repositoryId', 'repositoryFullName', 'defaultBranch', 'commitSha', 'scanId', 'findingId', 'rescanJobId', 'migrationId', 'draftPullRequestUrl', 'defaultBranchWriteObserved'])) return { error: 'acceptance contains an unsupported field.' };
  const requiredAcceptanceStrings = ['tenantId', 'repositoryId', 'repositoryFullName', 'defaultBranch', 'scanId', 'findingId', 'rescanJobId', 'migrationId'];
  if (requiredAcceptanceStrings.some((key) => !isNonEmptyString(acceptance[key]))) return { error: 'acceptance is missing a required identifier.' };
  if (!/^[^/\s]+\/[^/\s]+$/.test(String(acceptance.repositoryFullName)) || !isSha(acceptance.commitSha)) return { error: 'acceptance repositoryFullName or commitSha is invalid.' };
  if (typeof acceptance.draftPullRequestUrl !== 'string') return { error: 'acceptance.draftPullRequestUrl is required.' };
  try {
    const draftUrl = new URL(acceptance.draftPullRequestUrl);
    if (draftUrl.protocol !== 'https:' || draftUrl.hostname !== 'github.com' || !/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(draftUrl.pathname)) return { error: 'acceptance.draftPullRequestUrl must be a GitHub HTTPS Draft PR URL.' };
  } catch { return { error: 'acceptance.draftPullRequestUrl must be a URL.' }; }
  if (acceptance.defaultBranchWriteObserved !== false) return { error: 'defaultBranchWriteObserved must be false.' };
  const checks = value.checks;
  if (!isRecord(checks)) return { error: 'checks is required.' };
  if (!hasOnlyKeys(checks, REQUIRED_CHECKS)) return { error: 'checks contains an unsupported field.' };
  for (const key of REQUIRED_CHECKS) {
    const check = checks[key];
    if (!isRecord(check) || check.status !== 'pass' || !isTimestamp(check.observedAt) || !isNonEmptyString(check.reference)) return { error: `checks.${key} must contain a passing observation.` };
  }
  return { manifest: value as unknown as BetaEvidenceManifest };
}

/**
 * Loads only a checked-in, repository-local JSON evidence manifest. A file's
 * existence is never treated as live proof: the complete schema and all
 * required acceptance checks must validate before the readiness gate passes.
 */
export function loadBetaEvidenceManifest(repositoryRoot: string, configuredPath: string | undefined): BetaEvidenceValidation {
  if (!configuredPath) {
    return { valid: false, path: '', error: 'MY_OWL_BETA_EVIDENCE_MANIFEST is not set.' };
  }

  if (path.isAbsolute(configuredPath) || configuredPath.includes('..')) {
    return { valid: false, path: configuredPath, error: 'Evidence manifest must be a repository-local relative path.' };
  }

  const manifestPath = path.resolve(repositoryRoot, configuredPath);
  const relativePath = path.relative(repositoryRoot, manifestPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return { valid: false, path: manifestPath, error: 'Evidence manifest must remain inside the repository.' };
  }

  if (path.extname(manifestPath).toLowerCase() !== '.json') {
    return { valid: false, path: manifestPath, error: 'Evidence manifest must be a JSON file.' };
  }

  try {
    const repositoryRealPath = fs.realpathSync(repositoryRoot);
    const manifestRealPath = fs.realpathSync(manifestPath);
    const realRelativePath = path.relative(repositoryRealPath, manifestRealPath);
    if (!realRelativePath || realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
      return { valid: false, path: manifestPath, error: 'Evidence manifest must remain inside the repository.' };
    }
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
    const parsed = validateManifest(raw);
    if (!parsed.manifest) return { valid: false, path: manifestPath, error: parsed.error ?? 'Invalid evidence manifest.' };
    return { valid: true, manifest: parsed.manifest, path: manifestPath };
  } catch (error) {
    return { valid: false, path: manifestPath, error: error instanceof Error ? error.message : 'Unable to read evidence manifest.' };
  }
}

/**
 * Writes a validated, repository-local evidence manifest. By default this is
 * create-only so a second capture cannot silently replace an existing release
 * record; replacement must be an explicit operator choice.
 */
export function writeBetaEvidenceManifest(
  repositoryRoot: string,
  configuredPath: string,
  manifest: unknown,
  options: BetaEvidenceWriteOptions = {},
): BetaEvidenceValidation {
  if (!configuredPath || path.isAbsolute(configuredPath) || configuredPath.includes('..')) {
    return { valid: false, path: configuredPath, error: 'Evidence manifest must be a repository-local relative path.' };
  }
  const manifestPath = path.resolve(repositoryRoot, configuredPath);
  const relativePath = path.relative(repositoryRoot, manifestPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return { valid: false, path: manifestPath, error: 'Evidence manifest must remain inside the repository.' };
  }
  if (path.extname(manifestPath).toLowerCase() !== '.json') {
    return { valid: false, path: manifestPath, error: 'Evidence manifest must be a JSON file.' };
  }
  const parsed = validateManifest(manifest);
  if (!parsed.manifest) return { valid: false, path: manifestPath, error: parsed.error ?? 'Invalid evidence manifest.' };

  try {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const repositoryRealPath = fs.realpathSync(repositoryRoot);
    const parentRealPath = fs.realpathSync(path.dirname(manifestPath));
    const parentRelativePath = path.relative(repositoryRealPath, parentRealPath);
    if (!parentRelativePath || parentRelativePath.startsWith('..') || path.isAbsolute(parentRelativePath)) {
      return { valid: false, path: manifestPath, error: 'Evidence manifest must remain inside the repository.' };
    }
    if (fs.existsSync(manifestPath) && fs.lstatSync(manifestPath).isSymbolicLink()) {
      return { valid: false, path: manifestPath, error: 'Evidence manifest cannot be a symbolic link.' };
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(parsed.manifest, null, 2)}\n`, { encoding: 'utf8', flag: options.overwrite ? 'w' : 'wx' });
    return loadBetaEvidenceManifest(repositoryRoot, configuredPath);
  } catch (error) {
    return { valid: false, path: manifestPath, error: error instanceof Error ? error.message : 'Unable to write evidence manifest.' };
  }
}
