import { afterEach, describe, expect, it } from 'vitest';
import { buildMigrationTemplatePromotionQueue, buildReadinessReport, loadVerifiedMigrationTemplateIds } from '../apps/web/scripts/beta-readiness.js';
import { loadBetaEvidenceManifest, writeBetaEvidenceManifest } from '../apps/web/src/lib/server/beta-evidence.js';
import fs from 'node:fs';
import path from 'node:path';

describe('beta readiness inventory gate', () => {
  const originalProductizationFlag = process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;

  afterEach(() => {
    if (originalProductizationFlag === undefined) delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;
    else process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = originalProductizationFlag;
  });

  it('keeps the launch catalog and its explicit non-claims visible', () => {
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    const report = buildReadinessReport();
    expect(report.inventory.monitoredProviders).toBe(19);
    expect(report.inventory.discoveryProviders).toBeGreaterThanOrEqual(19);
    expect(report.inventory.officialCandidates).toBeGreaterThanOrEqual(19);
    expect(report.inventory.reviewArtifacts).toBe(report.inventory.officialCandidates);
    expect(report.inventory.executableTemplateProviders).toBeGreaterThan(0);
    expect(report.inventory.executableTemplateProviders).toBe(12);
    expect(report.inventory.verifiedMigrationTemplates).toBe(15);
    expect(loadVerifiedMigrationTemplateIds(process.cwd())).toEqual(new Set([
      'twilio-regional-api-domain-removal-2026-04-28',
      'twilio-studio-engagements-endpoint-deprecated',
      'openai-gpt-4-5-preview-removal-2025-07-14',
      'firebase-vertexai-import-alias-removed-2025-07-17',
      'firebase-vertexai-symbols-removed-2025-07-17',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'clerk-core-3-after-switch-organization-url-removed',
      'supabase-management-logs-all-removal-2026-09-23',
      'cloudflare-workers-kv-legacy-routes-2026-10-15',
      'launchdarkly-api-version-20220603-eol-2025-04-15',
      'elevenlabs-legacy-dubbing-endpoints-deprecated',
      'groq-qwen-3-6-27b-retired-2026-09-14',
      'shopify-api-2025-10-version-retired-2026-10-16',
      'sendgrid-web-api-v2-mail-send-migration',
      'sendgrid-v2-mail-send-migration-to-v3',
    ]));
    expect(loadVerifiedMigrationTemplateIds(path.join(process.cwd(), 'apps', 'web'))).toEqual(
      loadVerifiedMigrationTemplateIds(process.cwd()),
    );
    expect(report.gates.find((entry) => entry.id === 'source-catalog')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'discovery-catalog')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'candidate-catalog')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'review-artifact-coverage')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'deployment-cron-config')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'automation-capability-artifacts')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'automation-capability-artifacts')?.detail).toContain('guarded proposal service');
    expect(report.gates.find((entry) => entry.id === 'template-catalog')?.detail).toContain('human-reviewed bundled registry assets');
    expect(report.gates.find((entry) => entry.id === 'template-catalog')?.detail).toContain('12 providers and 15 exact templates');
    expect(report.migrationTemplatePromotionQueue.map((entry) => entry.providerId)).toEqual(['auth0', 'aws', 'braintree', 'google-cloud', 'slack', 'stripe', 'vercel']);
  });

  it('does not claim beta readiness while reviewed breadth or live evidence is incomplete', () => {
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
    const report = buildReadinessReport();
    expect(report.ready).toBe(false);
    expect(report.gates.find((entry) => entry.id === 'reviewed-rule-breadth')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'reviewed-rule-volume')?.status).toBe('pass');
    expect(report.gates.find((entry) => entry.id === 'migration-template-breadth')?.status).toBe('fail');
    expect(report.gates.find((entry) => entry.id === 'migration-template-breadth')?.detail).toContain('Missing:');
    expect(report.gates.find((entry) => entry.id === 'migration-template-breadth')?.detail).toContain('aws');
    expect(report.gates.find((entry) => entry.id === 'live-evidence-manifest')?.status).toBe('unverified');
    expect(report.gates.find((entry) => entry.id === 'live-evidence-registry-match')?.status).toBe('unverified');
    expect(report.gates.find((entry) => entry.id === 'migration-template-breadth')?.detail).toContain('auth0-connections-enabled-clients-deprecated-2026-01-21');
  });

  it('fails closed when the full productization scanner is not enabled', () => {
    delete process.env.PROVIDER_INTELLIGENCE_V1_ENABLED;
    const report = buildReadinessReport();
    expect(report.gates.find((entry) => entry.id === 'productization-scanner-enabled')).toMatchObject({ status: 'fail' });
  });

  it('builds an actionable promotion queue without promoting templates', () => {
    const queue = buildMigrationTemplatePromotionQueue(new Set());
    expect(queue).toHaveLength(19);
    expect(queue.find((entry) => entry.providerId === 'slack')).toMatchObject({
      proposalModes: ['manual-guidance'],
      candidateIds: expect.arrayContaining(['slack-files-upload-retired-2025-03-11']),
    });
    expect(queue.every((entry) => entry.nextStep.length > 0)).toBe(true);
  });

  it('rejects an evidence path outside the repository or a malformed manifest', () => {
    const root = process.cwd();
    expect(loadBetaEvidenceManifest(root, '..\\evidence.json').valid).toBe(false);

    const fixturePath = path.join('.tmp', 'invalid-beta-evidence.json');
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, JSON.stringify({ schemaVersion: 1 }), 'utf8');
    try {
      const result = loadBetaEvidenceManifest(root, fixturePath);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('releaseCommit');
    } finally {
      fs.rmSync(fixturePath, { force: true });
    }
  });

  it('writes only a schema-valid repository-local manifest and refuses silent replacement', () => {
    const root = process.cwd();
    const fixturePath = path.join('.tmp', 'beta-evidence-write-test.json');
    const manifest = {
      schemaVersion: 1,
      releaseCommit: 'a'.repeat(40),
      providerRegistryDigest: 'b'.repeat(64),
      generatedAt: '2026-10-29T10:00:00.000Z',
      operator: 'operator@example.com',
      acceptance: {
        tenantId: 'tenant-1', repositoryId: 'repo-1', repositoryFullName: 'owner/repo', defaultBranch: 'main',
        commitSha: 'c'.repeat(40), scanId: 'scan-1', findingId: 'finding-1', rescanJobId: 'rescan-1', migrationId: 'migration-1',
        draftPullRequestUrl: 'https://github.com/owner/repo/pull/1', defaultBranchWriteObserved: false,
      },
      checks: Object.fromEntries([
        'githubOnboarding', 'exactCommitScan', 'persistedFinding', 'approvalTriggeredRescan', 'draftPullRequest',
        'webhookReplayAndDeduplication', 'scheduledJobs', 'productionConfiguration', 'backupAndRestore', 'tenantIsolation',
        'billingAndNotifications', 'rollback',
      ].map((id) => [id, { status: 'pass', observedAt: '2026-10-29T10:00:00.000Z', reference: `${id}-evidence` }])),
    };
    try {
      expect(writeBetaEvidenceManifest(root, fixturePath, manifest).valid).toBe(true);
      expect(writeBetaEvidenceManifest(root, fixturePath, manifest).valid).toBe(false);
      expect(writeBetaEvidenceManifest(root, '..\\evidence.json', manifest).valid).toBe(false);
    } finally {
      fs.rmSync(fixturePath, { force: true });
    }
  });
});
