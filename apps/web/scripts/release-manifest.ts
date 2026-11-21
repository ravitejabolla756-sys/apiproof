import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DISCOVERY_PROVIDERS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
} from '@apiproof/providers';
import { TOOL_VERSION } from '@apiproof/shared';
import { PROVIDER_CHANGE_SOURCES } from '../src/lib/server/provider-change-monitor.js';
import { loadVerifiedMigrationTemplateIds } from '../src/lib/server/migration-template-verification.js';

export type ReleaseManifest = {
  schemaVersion: 1;
  generatedAt: string;
  version: string;
  git: {
    commit: string;
    branch: string;
    clean: boolean;
  };
  providerRegistryDigest: string;
  inventory: {
    monitoredProviders: number;
    discoveryProviders: number;
    officialCandidates: number;
    reviewedRules: number;
    declaredTemplateProviders: number;
    verifiedTemplateProviders: number;
    verifiedTemplates: number;
  };
  cron: {
    changelogMonitor: string;
    scheduledRescan: string;
  };
  ci: CiWorkflowContract;
  releaseEligible: boolean;
};

export type CiWorkflowContract = {
  valid: boolean;
  missing: string[];
  forbidden: string[];
};

export function validateCiWorkflowContract(workflow: string, branch = 'codex/v1-integration'): CiWorkflowContract {
  const normalized = workflow.replaceAll('\r\n', '\n');
  const required = [
    `push:\n    branches: [ main, ${branch} ]`,
    'pull_request:\n    branches: [ main ]',
    'permissions:\n  contents: read',
    'run: pnpm lint',
    'run: pnpm typecheck',
    'run: pnpm providers:validate:all',
    'run: pnpm providers:validate:multi',
    'run: pnpm test',
    'run: pnpm -r build',
    'run: pnpm release:manifest',
    'uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',
    'uses: pnpm/action-setup@0c17529a66aca453f9227af23103ed11469b1e47',
    'uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
  ];
  const forbidden = [
    'contents: write',
    'actions: write',
    'id-token: write',
    'vercel --prod',
    'workflow_dispatch:',
  ].filter((entry) => normalized.includes(entry));
  const missing = required.filter((entry) => !normalized.includes(entry));
  return { valid: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}

function runGit(repositoryRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function providerRegistryDigest(): string {
  return createHash('sha256')
    .update(JSON.stringify(PRODUCTION_COMPATIBILITY_REGISTRY.changes))
    .digest('hex');
}

function cronConfig(repositoryRoot: string): ReleaseManifest['cron'] {
  try {
    const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows/my-owl-scheduler.yml'), 'utf8');
    return {
      changelogMonitor: workflow.includes("cron: '0 */6 * * *'") && workflow.includes('/api/internal/provider-changelog') ? '0 */6 * * *' : 'missing',
      scheduledRescan: workflow.includes("cron: '0 2 * * *'") && workflow.includes('/api/internal/scheduled-rescan') ? '0 2 * * *' : 'missing',
    };
  } catch {
    return { changelogMonitor: 'missing', scheduledRescan: 'missing' };
  }
}

function ciConfig(repositoryRoot: string): CiWorkflowContract {
  try {
    return validateCiWorkflowContract(readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8'));
  } catch {
    return { valid: false, missing: ['.github/workflows/ci.yml'], forbidden: [] };
  }
}

export function buildReleaseManifest(repositoryRoot: string): ReleaseManifest {
  const verifiedTemplateIds = loadVerifiedMigrationTemplateIds(repositoryRoot);
  const verifiedTemplateProviders = new Set(
    MIGRATION_TEMPLATE_COVERAGE
      .filter((entry) => entry.templateIds.some((templateId) => verifiedTemplateIds.has(templateId)))
      .map((entry) => entry.providerId),
  );
  const cron = cronConfig(repositoryRoot);
  const ci = ciConfig(repositoryRoot);
  const commit = runGit(repositoryRoot, ['rev-parse', 'HEAD']);
  const branch = runGit(repositoryRoot, ['branch', '--show-current']);
  const clean = runGit(repositoryRoot, ['status', '--porcelain']) === '';
  const monitoredProviders = new Set(PROVIDER_CHANGE_SOURCES.map((source) => source.providerId));
  const reviewedRuleIds = new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId));
  const candidateIds = new Set(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => candidate.candidateId));
  const reviewedRulesHaveCandidates = [...reviewedRuleIds].every((changeId) => candidateIds.has(changeId));
  const releaseEligible = /^[a-f0-9]{40}$/i.test(commit)
    && clean
    && monitoredProviders.size === 19
    && [...monitoredProviders].every((providerId) => DISCOVERY_PROVIDERS.some((provider) => provider.id === providerId))
    && candidateIds.size >= 50
    && reviewedRuleIds.size >= 50
    && reviewedRulesHaveCandidates
    && ci.valid
    && cron.changelogMonitor !== 'missing'
    && cron.scheduledRescan !== 'missing';

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    version: TOOL_VERSION,
    git: { commit, branch, clean },
    providerRegistryDigest: providerRegistryDigest(),
    inventory: {
      monitoredProviders: monitoredProviders.size,
      discoveryProviders: DISCOVERY_PROVIDERS.length,
      officialCandidates: candidateIds.size,
      reviewedRules: PRODUCTION_COMPATIBILITY_REGISTRY.changes.length,
      declaredTemplateProviders: MIGRATION_TEMPLATE_COVERAGE.length,
      verifiedTemplateProviders: verifiedTemplateProviders.size,
      verifiedTemplates: verifiedTemplateIds.size,
    },
    cron,
    ci,
    releaseEligible,
  };
}

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const manifest = buildReleaseManifest(repositoryRoot);
  console.log(JSON.stringify(manifest, null, 2));
  process.exitCode = manifest.releaseEligible ? 0 : 1;
}
