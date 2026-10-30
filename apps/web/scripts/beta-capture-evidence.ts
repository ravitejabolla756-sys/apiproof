import path from 'node:path';
import process from 'node:process';
import { runBetaLivePreflight, type BetaLivePreflightResult } from './beta-live-preflight.js';
import {
  writeBetaEvidenceManifest,
  type BetaEvidenceManifest,
} from '../src/lib/server/beta-evidence.js';

const CHECK_IDS: Array<keyof BetaEvidenceManifest['checks']> = [
  'githubOnboarding', 'exactCommitScan', 'persistedFinding', 'approvalTriggeredRescan',
  'draftPullRequest', 'webhookReplayAndDeduplication', 'scheduledJobs',
  'productionConfiguration', 'backupAndRestore', 'tenantIsolation',
  'billingAndNotifications', 'rollback',
];

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. It is never printed.`);
  return value;
}

function parseJsonEnv<T>(name: string): T {
  const value = requiredEnv(name);
  try { return JSON.parse(value) as T; } catch { throw new Error(`${name} must contain valid JSON.`); }
}

function checkReferences(): Record<keyof BetaEvidenceManifest['checks'], string> {
  const references = parseJsonEnv<unknown>('MY_OWL_BETA_EVIDENCE_REFERENCES_JSON');
  if (!references || typeof references !== 'object' || Array.isArray(references)) throw new Error('MY_OWL_BETA_EVIDENCE_REFERENCES_JSON must be an object.');
  const result = references as Record<string, unknown>;
  const missing = CHECK_IDS.filter((id) => typeof result[id] !== 'string' || !result[id].trim());
  if (missing.length > 0) throw new Error(`Evidence references are missing: ${missing.join(', ')}.`);
  return Object.fromEntries(CHECK_IDS.map((id) => [id, String(result[id]).trim()])) as Record<keyof BetaEvidenceManifest['checks'], string>;
}

function buildManifest(preflight: BetaLivePreflightResult, references: Record<keyof BetaEvidenceManifest['checks'], string>): BetaEvidenceManifest {
  const acceptance = parseJsonEnv<unknown>('MY_OWL_BETA_EVIDENCE_ACCEPTANCE_JSON');
  if (!acceptance || typeof acceptance !== 'object' || Array.isArray(acceptance)) throw new Error('MY_OWL_BETA_EVIDENCE_ACCEPTANCE_JSON must be an object.');
  const value = acceptance as Record<string, unknown>;
  const required = ['tenantId', 'repositoryId', 'repositoryFullName', 'defaultBranch', 'commitSha', 'scanId', 'findingId', 'rescanJobId', 'migrationId', 'draftPullRequestUrl'];
  const missing = required.filter((key) => typeof value[key] !== 'string' || !value[key].trim());
  if (missing.length > 0) throw new Error(`Acceptance identifiers are missing: ${missing.join(', ')}.`);
  if (value.defaultBranchWriteObserved !== false) throw new Error('MY_OWL_BETA_EVIDENCE_ACCEPTANCE_JSON must set defaultBranchWriteObserved to false.');
  const registryDigest = requiredEnv('MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST').toLowerCase();
  const releaseCommit = requiredEnv('MY_OWL_BETA_RELEASE_COMMIT').toLowerCase();
  if (preflight.runtime?.workerCommitSha?.toLowerCase() !== releaseCommit) {
    throw new Error('MY_OWL_BETA_RELEASE_COMMIT does not match the deployed commit observed by live preflight.');
  }
  if (preflight.runtime?.providerRegistryDigest?.toLowerCase() !== registryDigest) {
    throw new Error('The deployed provider registry digest changed between preflight and evidence capture.');
  }
  return {
    schemaVersion: 1,
    releaseCommit,
    providerRegistryDigest: registryDigest,
    generatedAt: preflight.observedAt,
    operator: requiredEnv('MY_OWL_BETA_OPERATOR'),
    acceptance: {
      tenantId: String(value.tenantId), repositoryId: String(value.repositoryId), repositoryFullName: String(value.repositoryFullName),
      defaultBranch: String(value.defaultBranch), commitSha: String(value.commitSha), scanId: String(value.scanId),
      findingId: String(value.findingId), rescanJobId: String(value.rescanJobId), migrationId: String(value.migrationId),
      draftPullRequestUrl: String(value.draftPullRequestUrl), defaultBranchWriteObserved: false,
    },
    checks: Object.fromEntries(CHECK_IDS.map((id) => [id, { status: 'pass', observedAt: preflight.observedAt, reference: references[id] }])) as BetaEvidenceManifest['checks'],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const baseUrl = requiredEnv('MY_OWL_BETA_BASE_URL');
  const cronSecret = requiredEnv('CRON_SECRET');
  const expectedDigest = requiredEnv('MY_OWL_EXPECTED_PROVIDER_REGISTRY_DIGEST');
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
  const manifestPath = process.env.MY_OWL_BETA_EVIDENCE_MANIFEST?.trim() || 'docs/evidence/my-owl-beta-evidence.json';
  try {
    const preflight = await runBetaLivePreflight(baseUrl, cronSecret, fetch, expectedDigest);
    if (preflight.status !== 'pass') throw new Error('Live preflight failed; no evidence manifest was written.');
    const manifest = buildManifest(preflight, checkReferences());
    const result = writeBetaEvidenceManifest(repositoryRoot, manifestPath, manifest, { overwrite: process.argv.includes('--overwrite') });
    if (!result.valid) throw new Error(result.error);
    console.log(JSON.stringify({ status: 'pass', manifestPath: result.path, releaseCommit: manifest.releaseCommit, providerRegistryDigest: manifest.providerRegistryDigest }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Evidence capture failed.');
    process.exitCode = 1;
  }
}
