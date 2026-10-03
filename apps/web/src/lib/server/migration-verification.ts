import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  applyCandidate,
  buildPatchContext,
  computeCanonicalPatchDigest,
  cleanupPatchWorkspace,
  createSourcePatchWorkspace,
  createVerificationEvidence,
  findWorkspaceContentDrift,
  DeterministicPatchGenerator,
  DockerSandbox,
  FakeSandbox,
  verifyPatchedFixture,
  assertVerificationWorkspaceBounds,
  buildVerificationWorkspaceCommands,
  provisionVerificationDependencies,
  cleanupProvisionedDependencies,
  isVerificationWorkspacePath,
  loadGitHubAppConfig,
  NodeGitHubAppTokenProvider,
  GitHubAppSourceControlProvider,
  FetchGitHubReadTransport,
  type ExecutionSandbox,
  type VerifiedMigrationArtifact,
} from '@apiproof/core';
import { MigrationPlanSchema, VerificationReportSchema } from '@apiproof/shared';
import type { PlanningInput, VerificationReport } from '@apiproof/shared';
import { getDatabase } from './db/index.js';
import { loadProviderRegistry } from './registry-utils.js';
import { getWorkspaceGitHubInstallation } from './workspace-service.js';
import { readBoundMigrationProof } from './migration-proof.js';

export interface MigrationVerificationOptions {
  sandbox?: ExecutionSandbox;
  sourceFiles?: Readonly<Record<string, string>>;
  sourceSha?: string;
}

export interface MigrationVerificationResult {
  patchDigest: string;
  patchContent: Record<string, string>;
  patchDiff: string;
  evidence: VerifiedMigrationArtifact;
  report: VerificationReport;
  wrapper: Record<string, unknown>;
}

export type MigrationVerificationRepo = { id: string; workspace_id: string; owner: string; name: string; full_name: string; github_repository_id: string; default_branch: string; lifecycle?: string };
export type MigrationVerificationFinding = { id: string; repository_id: string; usage_id: string; change_id: string; provider: string; confidence: number; file_path: string; line_number: number; symbol: string; reason: string; reason_codes: string; evidence: string; source_snippet: string | null; source_digest?: string | null };
export type MigrationVerificationMigration = { id: string; finding_id: string; repository_id: string; plan_id: string; plan_json: string; patch_diff: string | null; patch_digest: string | null; patch_content?: string | null; baseline_sha?: string | null; verification_report: string | null };

function digest(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }

export function validateExactMigrationSource(input: { expectedBaselineSha: string; actualBaselineSha: string; expectedPath: string; actualPath: string; source: string | undefined; expectedSourceDigest: string | undefined }): void {
  if (input.expectedBaselineSha !== input.actualBaselineSha) throw new Error('BASELINE_SHA_MISMATCH: Source was fetched from a different commit.');
  if (input.expectedPath !== input.actualPath) throw new Error('TARGET_PATH_MISMATCH: Fetched source path is not the approved target path.');
  if (input.source === undefined) throw new Error('SOURCE_FILE_NOT_FOUND: Approved target source could not be fetched.');
  if (!input.expectedSourceDigest || digest(input.source) !== input.expectedSourceDigest) throw new Error('SOURCE_DIGEST_MISMATCH: Fetched source does not match scan evidence.');
}

export async function verifyMigrationForProposal(input: { migration: MigrationVerificationMigration; finding: MigrationVerificationFinding; repo: MigrationVerificationRepo; options?: MigrationVerificationOptions }): Promise<MigrationVerificationResult> {
  let baselineSha: string | undefined;
  let workspace: Awaited<ReturnType<typeof createSourcePatchWorkspace>> | undefined;
  let provisioning: Awaited<ReturnType<typeof provisionVerificationDependencies>> | undefined;
  let failurePersisted = false;
  try {
    if (process.env.NODE_ENV !== 'test' && input.options && Object.keys(input.options).length) throw new Error('VERIFICATION_TEST_OVERRIDE_FORBIDDEN: Captured source and sandbox overrides are test-only.');
    if (input.repo.lifecycle && input.repo.lifecycle !== 'active') throw new Error('REPOSITORY_NOT_ACTIVE: Historical or disconnected repositories cannot produce migration verification evidence.');
    baselineSha = input.migration.baseline_sha?.trim();
    if (!baselineSha || !/^[a-f0-9]{40}$/i.test(baselineSha)) throw new Error('BASELINE_SHA_INVALID: Migration is not bound to a valid scan commit.');
    const scan = await getDatabase().queryOne<{ id: string; sha: string; repository_id: string; status: string }>('SELECT id, sha, repository_id, status FROM scans WHERE id = (SELECT scan_id FROM findings WHERE id = ?)', [input.finding.id]);
    if (!scan || scan.status !== 'completed' || scan.repository_id !== input.repo.id || scan.sha !== baselineSha) throw new Error('BASELINE_SHA_MISMATCH: Migration baseline does not match the completed scan baseline.');

    const files = input.options?.sourceFiles ? new Map(Object.entries(input.options.sourceFiles)) : await fetchExactSource(input.repo, baselineSha);
    assertVerificationWorkspaceBounds(files);
    const source = files.get(input.finding.file_path);
    if (source === undefined) throw new Error(`SOURCE_FILE_NOT_FOUND: ${input.finding.file_path} was not present at baseline ${baselineSha}.`);
    const sourceDigest = digest(source);
    if (input.finding.source_digest && sourceDigest !== input.finding.source_digest) throw new Error('SOURCE_DIGEST_MISMATCH: Baseline source differs from scan evidence.');
    if (!input.finding.source_digest && process.env.NODE_ENV === 'production') throw new Error('SOURCE_DIGEST_MISSING: Scan evidence lacks the exact target source digest.');
    if (input.options?.sourceSha && input.options.sourceSha !== baselineSha) throw new Error('BASELINE_SHA_MISMATCH: Source provider returned a different commit.');

    const plan = MigrationPlanSchema.parse(JSON.parse(input.migration.plan_json));
    const changeList = await loadProviderRegistry(input.finding.provider as 'stripe' | 'twilio');
    const change = changeList.find((candidate) => candidate.id === input.finding.change_id);
    if (!change) throw new Error('CHANGE_NOT_FOUND: Migration change is not present in the approved registry.');
    const planningInput = buildPlanningInput(input.finding, input.repo.full_name, change as unknown as PlanningInput['change']);
    workspace = await createSourcePatchWorkspace(input.repo.github_repository_id, Object.fromEntries(files));
    const inferredColumn = inferSymbolColumn(source, input.finding.line_number, input.finding.symbol);
    const normalizedInput = inferredColumn ? { ...planningInput, impacts: planningInput.impacts.map((impact) => ({ ...impact, location: { ...impact.location, start: { ...impact.location.start, column: inferredColumn } } })) } : planningInput;
    const workspacePlan = { ...plan, repository: workspace.directory, affectedLocations: inferredColumn ? plan.affectedLocations.map((location) => ({ ...location, column: inferredColumn })) : plan.affectedLocations };
    const workspaceInput = { ...normalizedInput, repository: workspace.directory } as PlanningInput;
    if (workspacePlan.affectedLocations.length !== 1 || workspacePlan.affectedLocations[0]?.file !== input.finding.file_path) throw new Error('TARGET_PATH_MISMATCH: Approved migration target does not match the finding path.');
    const context = await buildPatchContext(workspace, workspaceInput, workspacePlan);
    const generated = await new DeterministicPatchGenerator().generate(context);
    const patch = await applyCandidate(workspace, context, generated);
    if (patch.status !== 'PATCH_READY_FOR_VALIDATION' || !patch.files.length || patch.validation.some((item) => !item.passed)) throw new Error(`PATCH_REJECTED: Deterministic patch was not safely applied (${patch.status}).`);
    const patchContent: Record<string, string> = {};
    for (const file of patch.files) {
      const result = await fs.readFile(path.join(workspace.directory, file.path), 'utf8');
      if (digest(result) !== file.patchedDigest) throw new Error(`RESULT_DIGEST_MISMATCH: ${file.path}`);
      patchContent[file.path] = result;
    }
    const patchDigest = computeCanonicalPatchDigest(patchContent);
    if (input.migration.verification_report && input.migration.patch_digest && input.migration.patch_digest !== patchDigest) throw new Error('PATCH_DIGEST_MISMATCH: Existing verification evidence belongs to a different resulting patch.');

    const sandbox = input.options?.sandbox ?? (process.env.NODE_ENV === 'test' ? new FakeSandbox() : new DockerSandbox());
    if (process.env.NODE_ENV === 'production' && !(sandbox instanceof DockerSandbox)) {
      throw new Error('VERIFICATION_EXECUTION_SANDBOX_REQUIRED: Production proposals require the isolated Docker sandbox.');
    }
    const fixture = buildVerificationWorkspaceCommands(
      `migration-${input.migration.id.replace(/[^a-z0-9-]/gi, '-')}`,
      files,
    );
    if (sandbox instanceof DockerSandbox) provisioning = await provisionVerificationDependencies(files, fixture);
    let report = await verifyPatchedFixture(patch, fixture, sandbox, { workspace: workspace.directory, ...(provisioning ? { dependencyProvisioning: provisioning } : {}) });
    const workspaceDrift = await findWorkspaceContentDrift(workspace, patchContent);
    if (workspaceDrift.length) {
      report = VerificationReportSchema.parse({
        ...report,
        status: 'VERIFICATION_SANDBOX_FAILED',
        warnings: [...report.warnings, `Verification modified tracked source or configuration: ${workspaceDrift.join(', ')}`],
      });
    }
    const reportDigest = digest(JSON.stringify(report));
    const passed = report.status === 'VERIFICATION_PASSED';
    const targetFiles = patch.files.map((file) => file.path).sort();
    const sourceDigests = Object.fromEntries(patch.files.map((file) => [file.path, file.originalDigest]));
    const resultingDigests = Object.fromEntries(patch.files.map((file) => [file.path, file.patchedDigest ?? digest(patchContent[file.path]!)]));
    const evidence = passed ? createVerificationEvidence({
      repositoryId: input.repo.github_repository_id,
      baselineSha,
      changeId: input.finding.change_id,
      patchDigest,
      proofLevel: sandbox instanceof DockerSandbox ? 'EXECUTION_VERIFIED' : 'CONTRACT_VERIFIED',
      patchApplied: true,
      typecheckPassed: passed && report.summary.typecheckPassed,
      testsPassed: passed && report.summary.testPassed,
      contractPassed: passed && patch.validation.every((item) => item.passed),
      verificationId: report.verificationId,
      verificationStatus: report.status,
      verificationReportDigest: reportDigest,
      targetFiles,
      sourceDigests,
      resultingDigests,
    }) : null;
    const wrapper = { schemaVersion: '1.0', migrationId: input.migration.id, repositoryId: input.repo.github_repository_id, baselineSha, patchDigest, targetFiles, sourceDigests, resultingDigests, report, evidence, failureReasons: passed ? [] : [...workspaceDrift.map((file) => `VERIFICATION_WORKSPACE_MUTATED: ${file}`), report.status] };
    const db = getDatabase();
    await db.execute('UPDATE migrations SET patch_digest = ?, patch_content = ?, patch_diff = ?, verification_report = ?, status = ? WHERE id = ?', [patchDigest, JSON.stringify(patchContent), patch.files.map((file) => file.unifiedDiff).join('\n'), JSON.stringify(wrapper), passed ? 'verified' : 'verification_failed', input.migration.id]);
    failurePersisted = true;
    if (!passed || !evidence) throw new Error(`VERIFICATION_FAILED: ${report.status}`);
    return { patchDigest, patchContent, patchDiff: patch.files.map((file) => file.unifiedDiff).join('\n'), evidence, report, wrapper };
  } catch (error: unknown) {
    if (!failurePersisted) {
      await persistVerificationFailure(input, baselineSha, error);
    }
    throw error;
  } finally {
    if (workspace) await cleanupPatchWorkspace(workspace);
    if (provisioning) await cleanupProvisionedDependencies(provisioning);
  }
}

async function persistVerificationFailure(input: { migration: MigrationVerificationMigration; repo: MigrationVerificationRepo }, baselineSha: string | undefined, error: unknown): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  const status = /Docker exit unavailable|Docker CLI unavailable|VERIFICATION_DOCKER_.*UNAVAILABLE|VERIFICATION_PINNED_IMAGE_UNAVAILABLE/.test(reason)
    ? 'verification_unavailable'
    : 'verification_failed';
  const wrapper = {
    schemaVersion: '1.0',
    migrationId: input.migration.id,
    repositoryId: input.repo.github_repository_id,
    baselineSha: baselineSha ?? input.migration.baseline_sha ?? null,
    patchDigest: input.migration.patch_digest ?? null,
    targetFiles: [],
    sourceDigests: {},
    resultingDigests: {},
    report: null,
    evidence: null,
    failureReasons: [reason],
    failedAt: new Date().toISOString(),
  };
  await getDatabase().execute('UPDATE migrations SET verification_report = ?, status = ? WHERE id = ?', [JSON.stringify(wrapper), status, input.migration.id]);
}

export function validatePersistedMigrationEvidence(raw: string | null | undefined, expected: { repositoryId: string; baselineSha: string; changeId: string; patchDigest: string }): void {
  readBoundMigrationProof(raw, expected);
}

async function fetchExactSource(repo: MigrationVerificationRepo, baselineSha: string): Promise<Map<string, string>> {
  const installation = await getWorkspaceGitHubInstallation(repo.workspace_id);
  if (!installation) {
    if (process.env.NODE_ENV !== 'test') throw new Error('WORKSPACE_GITHUB_NOT_CONNECTED: Exact source retrieval requires an active GitHub installation.');
    const fixtureRoot = 'C:\\apiproof-github-fixture';
    const files = new Map<string, string>();
    try {
      if (repo.name !== 'apiproof-github-fixture') throw new Error('synthetic-test-source');
      files.set('src/billing.ts', await fs.readFile(path.join(fixtureRoot, 'src/billing.ts'), 'utf8'));
      files.set('package.json', await fs.readFile(path.join(fixtureRoot, 'package.json'), 'utf8'));
      for (const lockfile of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
        try { files.set(lockfile, await fs.readFile(path.join(fixtureRoot, lockfile), 'utf8')); break; }
        catch { /* Try the next supported lockfile; absence is rejected by command selection. */ }
      }
    } catch {
      files.set('src/billing.ts', `import Stripe from 'stripe';\nconst stripe = new Stripe('sk_test_fixture');\nexport function migrate() {\n  const customerId = 'customer';\n  const priceId = 'price';\n  const couponId = 'coupon';\n  const metadata = {};\n  const options = {};\n\n  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], coupon: couponId });\n}`);
      files.set('package.json', JSON.stringify({ name: repo.name, dependencies: { stripe: '^16.0.0' } }));
      files.set('pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      stripe:\n        specifier: ^16.0.0\n        version: 16.12.0\n");
    }
    return files;
  }
  const config = loadGitHubAppConfig();
  const tokens = new NodeGitHubAppTokenProvider(config, { allowAnyRepository: true });
  const provider = new GitHubAppSourceControlProvider({ ...config, installationId: installation.installationId, repositoryId: repo.github_repository_id, owner: repo.owner, repository: repo.name }, tokens, new FetchGitHubReadTransport());
  const tree = await provider.readTree(baselineSha);
  const files = new Map<string, string>();
  const selectedFiles = tree.filter(isVerificationWorkspacePath);
  assertVerificationWorkspaceBounds(new Map(selectedFiles.map((file) => [file, ''])));
  for (const file of selectedFiles) {
    files.set(file, await provider.readFile(file, baselineSha));
    assertVerificationWorkspaceBounds(files);
  }
  return files;
}

function inferSymbolColumn(source: string, lineNumber: number, symbol: string): number | undefined {
  const line = source.split('\n')[lineNumber - 1] ?? '';
  const index = line.indexOf(symbol);
  return index >= 0 ? index + 1 : undefined;
}

function buildPlanningInput(finding: MigrationVerificationFinding, repository: string, change: PlanningInput['change']): PlanningInput {
  const parsedEvidence = JSON.parse(finding.evidence) as Array<{ detail?: string }>;
  const reasonCodes = JSON.parse(finding.reason_codes) as string[];
  const impactId = `impact:${finding.usage_id}`;
  return { change, repository, analysisDigest: digest(finding.id), impacts: [{ usageId: finding.usage_id, changeId: finding.change_id, symbol: finding.symbol, location: { file: finding.file_path, start: { line: finding.line_number, column: 1 }, end: { line: finding.line_number, column: 50 } }, reason: finding.reason, confidence: finding.confidence, versionAssessment: 'unknown', reasonCodes }], evidence: [{ id: `change:${change.id}`, kind: 'change', label: `Reviewed change record ${change.id}.`, changeId: change.id }, { id: impactId, kind: 'impact', label: `${finding.symbol} affected at ${finding.file_path}:${finding.line_number}`, changeId: change.id, symbol: finding.symbol }, ...parsedEvidence.map((item, index) => ({ id: `${impactId}:${index}`, kind: 'impact' as const, label: item.detail ?? 'Evidence item', changeId: change.id }))], facts: [{ id: `fact:change:${change.id}`, kind: 'change', statement: `Change record ${change.id} is official and reviewed.`, evidenceIds: [`change:${change.id}`] }, { id: `fact:operation:${finding.usage_id}`, kind: 'operation', statement: `Affected operation: ${finding.symbol}.`, evidenceIds: [impactId] }, { id: `fact:location:${finding.usage_id}`, kind: 'location', statement: `Location: ${finding.file_path}:${finding.line_number}`, evidenceIds: [impactId] }], snippets: finding.source_snippet ? [{ evidenceId: impactId, file: finding.file_path, startLine: Math.max(1, finding.line_number - 2), endLine: finding.line_number + 2, text: finding.source_snippet, redacted: false }] : [], warnings: [], unresolvedQuestions: [], migrationInstructions: change.migrationInstructions ?? [], bounds: { maxSnippetLines: 24, maxSnippetChars: 12_000, maxTotalChars: 64_000 }, sourceDigest: digest(finding.source_snippet ?? '') };
}
