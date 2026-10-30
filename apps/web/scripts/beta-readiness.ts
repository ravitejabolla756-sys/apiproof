import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DISCOVERY_PROVIDERS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  deriveReviewOnlyTemplateProposal,
} from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '../src/lib/server/provider-change-monitor.js';
import { loadBetaEvidenceManifest } from '../src/lib/server/beta-evidence.js';
import { loadVerifiedMigrationTemplateIds } from '../src/lib/server/migration-template-verification.js';
export { loadVerifiedMigrationTemplateIds } from '../src/lib/server/migration-template-verification.js';

export type ReadinessStatus = 'pass' | 'fail' | 'unverified';
export type ReadinessGate = { id: string; status: ReadinessStatus; detail: string };
export type MigrationTemplatePromotionItem = {
  providerId: string;
  candidateIds: string[];
  proposalModes: Array<'transform' | 'manual-guidance'>;
  nextStep: string;
};
export type ReadinessReport = { generatedAt: string; ready: boolean; gates: ReadinessGate[]; inventory: Record<string, number>; migrationTemplatePromotionQueue: MigrationTemplatePromotionItem[] };

function gate(id: string, status: ReadinessStatus, detail: string): ReadinessGate {
  return { id, status, detail };
}

function setOf(values: readonly string[]): Set<string> {
  return new Set(values);
}

function providerRegistryDigest(): string {
  return createHash('sha256').update(JSON.stringify(PRODUCTION_COMPATIBILITY_REGISTRY.changes)).digest('hex');
}

function gitIsClean(): boolean {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: path.resolve(import.meta.dirname, '../../..'), encoding: 'utf8' }).trim().length === 0;
  } catch {
    return false;
  }
}

function deploymentCronConfigIsValid(repositoryRoot: string): boolean {
  try {
    const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows/my-owl-scheduler.yml'), 'utf8');
    return workflow.includes("cron: '0 */6 * * *'")
      && workflow.includes("cron: '0 2 * * *'")
      && workflow.includes('/api/internal/provider-changelog')
      && workflow.includes('/api/internal/scheduled-rescan');
  } catch {
    return false;
  }
}

function requiredCapabilityArtifacts(repositoryRoot: string): string[] {
  const required = [
    'apps/web/src/lib/server/provider-change-monitor.ts',
    'apps/web/src/lib/server/provider-rule-service.ts',
    'apps/web/src/lib/server/repository-rescan-worker.ts',
    'apps/web/src/lib/server/proposal-service.ts',
    'apps/web/src/lib/server/slack-notifications.ts',
    'apps/web/src/app/api/internal/provider-changelog/route.ts',
    'apps/web/src/app/api/internal/scheduled-rescan/route.ts',
  ];
  return required.filter((relativePath) => !readFileExists(path.join(repositoryRoot, relativePath)));
}

function readFileExists(filePath: string): boolean {
  try {
    readFileSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Produces the exact human-review queue for providers without a verified
 * executable template. This is planning evidence only; it never promotes a
 * rule or changes the bundled transformation registry.
 */
export function buildMigrationTemplatePromotionQueue(verifiedTemplateIds: ReadonlySet<string>): MigrationTemplatePromotionItem[] {
  const sourceProviderIds = new Set(PROVIDER_CHANGE_SOURCES.map((source) => source.providerId));
  const verifiedProviders = new Set(MIGRATION_TEMPLATE_COVERAGE
    .filter((entry) => entry.templateIds.some((templateId) => verifiedTemplateIds.has(templateId)))
    .map((entry) => entry.providerId));
  return [...sourceProviderIds]
    .filter((providerId) => !verifiedProviders.has(providerId))
    .sort()
    .map((providerId) => {
      const candidates = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.filter((candidate) => candidate.providerId === providerId);
      const proposalModes = [...new Set(candidates.map((candidate) => deriveReviewOnlyTemplateProposal(candidate)?.mode).filter((mode): mode is 'transform' | 'manual-guidance' => mode !== undefined))].sort() as Array<'transform' | 'manual-guidance'>;
      return {
        providerId,
        candidateIds: candidates.map((candidate) => candidate.candidateId).sort(),
        proposalModes,
        nextStep: proposalModes.includes('transform')
          ? 'Review the bounded transform proposal with three fixtures, then add a human-reviewed digest-bound registry asset.'
          : 'Complete the manual migration review and only promote an executable template if behavior-preserving AST equivalence is proven.',
      };
    });
}

/**
 * Computes a conservative, read-only beta gate. It intentionally reports
 * production and live-integration evidence as unverified until an operator
 * supplies an evidence manifest; local inventory must never masquerade as
 * deployed proof.
 */
export function buildReadinessReport(): ReadinessReport {
  const sourceProviders = setOf(PROVIDER_CHANGE_SOURCES.map((source) => source.providerId));
  const discoveryProviders = setOf(DISCOVERY_PROVIDERS.map((provider) => provider.id));
  const candidateProviders = setOf(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => candidate.providerId));
  const templateProviders = setOf(MIGRATION_TEMPLATE_COVERAGE.map((entry) => entry.providerId));
  const reviewedSourceProviders = new Set([...PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.keys()].filter((providerId) => sourceProviders.has(providerId)));
  const expectedProviderCount = 19;
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
  const verifiedTemplateIds = loadVerifiedMigrationTemplateIds(repositoryRoot);
  const executableTemplateProviders = new Set(MIGRATION_TEMPLATE_COVERAGE.filter((entry) => entry.templateIds.some((templateId) => verifiedTemplateIds.has(templateId))).map((entry) => entry.providerId));
  const evidenceManifest = process.env.MY_OWL_BETA_EVIDENCE_MANIFEST;
  const evidenceValidation = loadBetaEvidenceManifest(repositoryRoot, evidenceManifest);
  const currentRegistryDigest = providerRegistryDigest();
  const evidenceRegistryMatches = evidenceValidation.valid && evidenceValidation.manifest.providerRegistryDigest.toLowerCase() === currentRegistryDigest;
  const cleanTree = gitIsClean();
  const cronConfigValid = deploymentCronConfigIsValid(repositoryRoot);
  const productizationEnabled = process.env.PROVIDER_INTELLIGENCE_V1_ENABLED === 'true';
  const missingCapabilityArtifacts = requiredCapabilityArtifacts(repositoryRoot);
  const missingVerifiedTemplateProviders = [...sourceProviders].filter((providerId) => !executableTemplateProviders.has(providerId)).sort();
  const reviewArtifactCount = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.filter((candidate) => deriveReviewOnlyTemplateProposal(candidate) !== undefined).length;
  const migrationTemplatePromotionQueue = buildMigrationTemplatePromotionQueue(verifiedTemplateIds);
  const missingTemplateDetail = migrationTemplatePromotionQueue.map((item) => `${item.providerId} [${item.candidateIds.join(', ') || 'no current candidate'}]`).join('; ');
  const gates: ReadinessGate[] = [
    gate('source-catalog', sourceProviders.size === expectedProviderCount && PROVIDER_CHANGE_SOURCES.every((source) => new URL(source.sourceUrl).protocol === 'https:') ? 'pass' : 'fail', `${sourceProviders.size}/${expectedProviderCount} monitored providers with HTTPS sources.`),
    gate('discovery-catalog', discoveryProviders.size >= expectedProviderCount && [...sourceProviders].every((provider) => discoveryProviders.has(provider)) ? 'pass' : 'fail', `${discoveryProviders.size} total discovery providers include all ${expectedProviderCount} monitored providers.`),
    gate('candidate-catalog', candidateProviders.size >= expectedProviderCount && [...sourceProviders].every((provider) => candidateProviders.has(provider)) ? 'pass' : 'fail', `${OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.length} official candidates cover all ${expectedProviderCount} monitored providers; ${candidateProviders.size - expectedProviderCount} additional provider(s) are outside the launch catalog.`),
    gate('review-artifact-coverage', reviewArtifactCount === OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.length ? 'pass' : 'fail', `${reviewArtifactCount}/${OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.length} official candidates have a bounded transform proposal or manual migration playbook.`),
    gate('deployment-cron-config', cronConfigValid ? 'pass' : 'fail', cronConfigValid ? 'GitHub Actions scheduler declares the six-hour changelog monitor and nightly scheduled rescan.' : 'Repository scheduler is missing one or more required provider-monitoring schedules.'),
    gate('productization-scanner-enabled', productizationEnabled ? 'pass' : 'fail', productizationEnabled ? 'The full provider-intelligence scanner is explicitly enabled for the release environment.' : 'Set PROVIDER_INTELLIGENCE_V1_ENABLED=true before live beta; otherwise scans remain on the legacy rollback path.'),
    gate('automation-capability-artifacts', missingCapabilityArtifacts.length === 0 ? 'pass' : 'fail', missingCapabilityArtifacts.length === 0
      ? 'Source monitor, review service, rescan worker, guarded proposal service, Slack notifier, and both protected orchestration routes are present.'
      : `Missing required automation artifacts: ${missingCapabilityArtifacts.join(', ')}.`),
    gate('template-catalog', templateProviders.size === expectedProviderCount && MIGRATION_TEMPLATE_COVERAGE.every((entry) => entry.requiresHumanReview) ? 'pass' : 'fail', `${MIGRATION_TEMPLATE_COVERAGE.filter((entry) => entry.status === 'deterministic-ast').length} providers declare executable templates; ${executableTemplateProviders.size} providers and ${verifiedTemplateIds.size} exact templates are verified against human-reviewed bundled registry assets.`),
    gate('reviewed-rule-breadth', reviewedSourceProviders.size === expectedProviderCount ? 'pass' : 'fail', `${reviewedSourceProviders.size}/${expectedProviderCount} monitored providers have static reviewed rules.`),
    gate('reviewed-rule-volume', PRODUCTION_COMPATIBILITY_REGISTRY.changes.length >= 50 ? 'pass' : 'fail', `${PRODUCTION_COMPATIBILITY_REGISTRY.changes.length}/50 approved reviewed rules.`),
    gate('migration-template-breadth', executableTemplateProviders.size === expectedProviderCount ? 'pass' : 'fail', executableTemplateProviders.size === expectedProviderCount
      ? `${executableTemplateProviders.size}/${expectedProviderCount} providers have verified executable migration templates (${verifiedTemplateIds.size} verified rules).`
      : `${executableTemplateProviders.size}/${expectedProviderCount} providers have verified executable migration templates (${verifiedTemplateIds.size} verified rules). Missing: ${missingTemplateDetail || missingVerifiedTemplateProviders.join(', ')}.`),
    gate('clean-release-tree', cleanTree ? 'pass' : 'fail', cleanTree ? 'Working tree is clean.' : 'Working tree contains changes; freeze a release commit before beta.'),
    gate('live-evidence-manifest', evidenceValidation.valid ? 'pass' : 'unverified', evidenceValidation.valid ? `Validated evidence manifest at ${path.relative(repositoryRoot, evidenceValidation.path)}.` : `Live evidence is not validated: ${evidenceValidation.error}`),
    gate('live-evidence-registry-match', evidenceValidation.valid ? (evidenceRegistryMatches ? 'pass' : 'fail') : 'unverified', evidenceValidation.valid ? (evidenceRegistryMatches ? 'Evidence manifest matches the current reviewed provider registry.' : 'Evidence manifest provider registry digest does not match the current reviewed registry.') : 'Registry match cannot be evaluated until the live evidence manifest validates.'),
  ];
  const ready = gates.every((entry) => entry.status === 'pass');
  return {
    generatedAt: new Date().toISOString(),
    ready,
    gates,
    inventory: {
      monitoredProviders: sourceProviders.size,
      discoveryProviders: discoveryProviders.size,
      officialCandidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.length,
      reviewedStaticRules: PRODUCTION_COMPATIBILITY_REGISTRY.changes.length,
      reviewedProviders: reviewedSourceProviders.size,
      reviewArtifacts: reviewArtifactCount,
      executableTemplateProviders: executableTemplateProviders.size,
      verifiedMigrationTemplates: verifiedTemplateIds.size,
    },
    migrationTemplatePromotionQueue,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const report = buildReadinessReport();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 1;
}
