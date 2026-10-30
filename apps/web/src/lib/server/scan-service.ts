import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { TypeScriptRepositoryAnalyzer, RepositorySnapshot, discoverProviders, runProductizationScan } from '@apiproof/analyzers';
import { StripeProvider, TwilioProvider, DISCOVERY_PROVIDER_REGISTRY } from '@apiproof/providers';
import {
  type ApiProvider,
  type GitHubAppSourceControlProvider,
} from '@apiproof/core';
import type { NormalizedUsageIR, ScanResult } from '@apiproof/shared';
import { getDatabase } from './db/index.js';
import { enqueueNewFindingNotifications } from './slack-notifications.js';
import { createWorkspaceGitHubSourceControlProvider, fetchRemoteRepositoryFiles } from './github.js';
import { loadActiveProductionRegistry, loadProviderRegistry } from './registry-utils.js';
import { requireRepositoryAccess, getWorkspaceGitHubInstallation } from './workspace-service.js';
import { summarizeScanCompatibility } from './scan-compatibility-evidence.js';
import { scanResultWithDiscovery } from './scan-discovery-evidence.js';
import { assertFounderScanAuthorization } from './founder-scan-authorization.js';
import { providerIntelligenceV1Enabled } from './provider-intelligence-feature.js';
import { productizationFindings, type ProductizationFinding } from './productization-worker.js';
import { boundedProductizationProjection } from './productization-persistence.js';
import { replaceRepositoryProviderUsage } from './repository-provider-usage.js';
import { createSyntheticTestFixtureFiles } from './test-fixture-source.js';

export interface ScanExecutionResult {
  scanId: string;
  repositoryId: string;
  sha: string;
  filesAnalyzed: number;
  findingsCount: number;
  status: 'completed' | 'failed';
  providersDetected: string[];
  findings: Array<{
    id: string;
    changeId: string;
    provider: string;
    title: string;
    symbol: string;
    filePath: string;
    lineNumber: number;
    severity: string;
    confidence: number;
  }>;
}

function extractSourceSnippet(fileContent: string, lineNumber: number, contextLines = 3): string {
  const lines = fileContent.split('\n');
  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length, lineNumber + contextLines);
  return lines.slice(start, end).map((line, idx) => {
    const currentLineNum = start + idx + 1;
    const marker = currentLineNum === lineNumber ? '>' : ' ';
    return `${marker} ${currentLineNum.toString().padStart(4, ' ')} | ${line}`;
  }).join('\n');
}

export async function runRepositoryScan(
  repositoryId: string,
  userId: string,
  customProvider?: GitHubAppSourceControlProvider
): Promise<ScanExecutionResult> {
  // Keep the live-scan boundary inside the service so alternate callers cannot
  // bypass the route-level authorization check.
  assertFounderScanAuthorization(userId);
  const db = getDatabase();
  
  // 1. Verify workspace repository access (central authorization / IDOR protection)
  const { repository: repo } = await requireRepositoryAccess(repositoryId, userId);
  if (customProvider && process.env.NODE_ENV !== 'test') throw new Error('GITHUB_TEST_PROVIDER_FORBIDDEN: Source provider overrides are available only to automated tests.');
  if (repo.lifecycle !== 'active') {
    throw new Error('REPOSITORY_NOT_ACTIVE: Historical or disconnected repositories cannot be scanned.');
  }

  const scanId = `scn_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  // 2. Insert scan record in 'running' state within transaction
  await db.transaction(async (tx) => {
    await tx.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [scanId, repo.id, 'pending', 'running', 'multi-provider', now]);

    await tx.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `act_${crypto.randomBytes(10).toString('hex')}`,
      userId,
      repo.id,
      'scan_started',
      'Scan Started',
      `AST compatibility scan started for ${repo.full_name}.`,
      now
    ]);
  });

  try {
    let filesMap = new Map<string, string>();
    let headSha = '';

    // 3. Fetch source files from the workspace-owned GitHub installation.
    // Synthetic/local fixture material is available only to automated tests.
    const installation = repo.workspace_id ? await getWorkspaceGitHubInstallation(repo.workspace_id) : null;
    const isTestFixture = process.env.NODE_ENV === 'test';

    let githubProvider = customProvider ?? null;
    if (!customProvider && repo.workspace_id && installation) {
      githubProvider = createWorkspaceGitHubSourceControlProvider({
        installationId: installation.installationId,
        repositoryId: repo.github_repository_id,
        owner: repo.owner,
        repository: repo.name,
      });
    }

    if (customProvider || installation) {
      if (!githubProvider) {
        throw new Error('GITHUB_APP_NOT_CONFIGURED: Active GitHub App configuration is required to scan connected repository.');
      }
      // Strictly fetch from remote GitHub — NEVER fall back to local fixture
      const remoteData = await fetchRemoteRepositoryFiles(githubProvider);
      filesMap = remoteData.files;
      headSha = remoteData.headSha;

      if (!headSha || !/^[a-f0-9]{40}$/i.test(headSha)) {
        throw new Error('GITHUB_INVALID_RESPONSE: Invalid commit SHA returned for repository default branch.');
      }
      if (filesMap.size === 0) {
        throw new Error(`GITHUB_REPOSITORY_EMPTY: Remote repository '${repo.full_name}' contains no code files to analyze.`);
      }
    } else {
      if (!isTestFixture) {
        throw new Error('GITHUB_APP_NOT_CONFIGURED: Live GitHub source retrieval requires an active workspace installation.');
      }
      // Local development/test fixture fallback ONLY for offline test fixture
      if (repo.name === 'apiproof-github-fixture' || repo.owner === 'ravitejabolla756-sys') {
        const localFixturePath = path.resolve('C:\\apiproof-github-fixture');
        if (fs.existsSync(localFixturePath)) {
          const billingPath = path.join(localFixturePath, 'src/billing.ts');
          const pkgPath = path.join(localFixturePath, 'package.json');
          if (fs.existsSync(billingPath)) {
            filesMap.set('src/billing.ts', fs.readFileSync(billingPath, 'utf8'));
          }
          if (fs.existsSync(pkgPath)) {
            filesMap.set('package.json', fs.readFileSync(pkgPath, 'utf8'));
          }
        } else {
          // Built-in synthetic fixture if external directory absent.
          filesMap = createSyntheticTestFixtureFiles(repo.name);
        }
        headSha = 'b1be45b401f41106ecfd489bbbb1fff71639c763';
      } else {
        throw new Error(`REPOSITORY_SOURCE_UNAVAILABLE: Repository '${repo.full_name}' is not connected to GitHub and has no local test fixture.`);
      }
    }

    // 4. Construct RepositorySnapshot and select the reviewed productization path.
    // The flag remains the explicit rollout boundary: legacy scans stay available
    // for rollback and existing installations are not silently changed.
    const snapshot = RepositorySnapshot.fromMemory(repo.name, filesMap);
    const productizationEnabled = providerIntelligenceV1Enabled();
    const activeProductionRegistry = productizationEnabled ? await loadActiveProductionRegistry(repo.workspace_id) : undefined;
    const productization = productizationEnabled
      ? await runProductizationScan({
          repositoryId: repo.id,
          baselineSha: headSha,
          scanId,
          files: filesMap,
          ...(activeProductionRegistry ? { registry: activeProductionRegistry } : {}),
        })
      : null;
    const analyzer = new TypeScriptRepositoryAnalyzer();
    const discoveredProviders = productization?.discoveries ?? discoverProviders(filesMap, DISCOVERY_PROVIDER_REGISTRY);

    // 5. Detect providers from package.json
    const providersToAnalyze: Array<{ id: 'stripe' | 'twilio'; provider: ApiProvider }> = [];
    const pkgContent = filesMap.get('package.json');
    // Keep the reviewed legacy adapters as a compatibility bridge for rules
    // that have not yet been projected into the normalized registry (notably
    // the established Stripe corpus). Productization remains authoritative for
    // normalized results; this bridge prevents a rollout from losing coverage.
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.stripe) {
          providersToAnalyze.push({ id: 'stripe', provider: new StripeProvider() });
        }
        if (deps.twilio) {
          providersToAnalyze.push({ id: 'twilio', provider: new TwilioProvider() });
        }
      } catch {
        // fallback
      }
    }
    if (!productizationEnabled && providersToAnalyze.length === 0) {
      providersToAnalyze.push({ id: 'stripe', provider: new StripeProvider() });
    }

    // 6. Run AST scan & impact analysis for each provider
    const collectedFindings: ProductizationFinding[] = [];

    let totalFilesAnalyzed = 0;
    let inputDigest = snapshot.digest();
    const compatibilityResults: ScanResult[] = [];

    if (productization) {
      totalFilesAnalyzed = productization.metrics.analyzedFiles;
      inputDigest = productization.baselineSha;
      collectedFindings.push(...productizationFindings(productization));
    }

    for (const { id: provId, provider } of providersToAnalyze) {
      const scanResult = await analyzer.analyze(snapshot, provider.descriptor);
      compatibilityResults.push(scanResult);
      totalFilesAnalyzed = Math.max(totalFilesAnalyzed, scanResult.coverage.filesAnalyzed);
      if (!productization) inputDigest = scanResult.audit.inputDigest;

      const registryChanges = await loadProviderRegistry(provId, repo.workspace_id);
      for (const change of registryChanges) {
        const { impacts } = provider.matchImpact(scanResult, change);
        for (const impact of impacts) {
          const findingId = `fnd_${crypto.randomBytes(12).toString('hex')}`;
          const filePath = impact.location.file;
          const lineNumber = impact.location.start.line;
          const fileRaw = filesMap.get(filePath) ?? '';
          const snippet = extractSourceSnippet(fileRaw, lineNumber);

          collectedFindings.push({
            id: findingId,
            changeId: change.id,
            provider: provId,
            title: change.title,
            description: change.description,
            severity: change.severity,
            confidence: impact.confidence,
            filePath,
            lineNumber,
            symbol: impact.symbol,
            reason: impact.reason,
            reasonCodes: impact.reasonCodes,
            evidence: impact.evidence,
            sourceSnippet: snippet,
            sourceDigest: crypto.createHash('sha256').update(fileRaw).digest('hex'),
          });
        }
      }
    }

    // 7. Persist findings to database inside a transaction with deduplication
    const newlyCreatedFindingIds: string[] = [];
    const persistedScanResult = productization
      ? { schemaVersion: 2, productization: boundedProductizationProjection(productization) }
      : scanResultWithDiscovery(
          summarizeScanCompatibility(compatibilityResults),
          discoveredProviders,
          compatibilityResults.flatMap((result) => (result as unknown as { usageIR?: NormalizedUsageIR[] }).usageIR ?? []),
        );
    const observedProviderIds = productization
      ? [...productization.discoveries.map((item) => item.providerId), ...productization.usageIR.map((item) => item.providerId)]
      : [...providersToAnalyze.map((provider) => provider.id), ...collectedFindings.map((finding) => finding.provider)];
    await db.transaction(async (tx) => {
      const activeFindingIds: string[] = [];

      for (const f of collectedFindings) {
        const existing = await tx.queryOne<{ id: string; status: string }>(`
          SELECT id, status FROM findings
          WHERE repository_id = ? AND change_id = ? AND file_path = ? AND symbol = ?
        `, [repo.id, f.changeId, f.filePath, f.symbol]);

        if (existing) {
          await tx.execute(`
            UPDATE findings
            SET scan_id = ?,
                line_number = ?,
                confidence = ?,
                reason = ?,
                reason_codes = ?,
                evidence = ?,
                source_snippet = ?,
                source_digest = ?
            WHERE id = ?
          `, [
            scanId,
            f.lineNumber,
            f.confidence,
            f.reason,
            JSON.stringify(f.reasonCodes),
            JSON.stringify(f.evidence),
            f.sourceSnippet,
            f.sourceDigest,
            existing.id
          ]);
          activeFindingIds.push(existing.id);
        } else {
          await tx.execute(`
            INSERT INTO findings (
              id, scan_id, repository_id, usage_id, change_id, provider, title, description,
              severity, confidence, file_path, line_number, symbol, status, reason, reason_codes,
              evidence, source_snippet, source_digest, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
          `, [
            f.id,
            scanId,
            repo.id,
            f.id, // usage_id
            f.changeId,
            f.provider,
            f.title,
            f.description,
            f.severity,
            f.confidence,
            f.filePath,
            f.lineNumber,
            f.symbol,
            f.reason,
            JSON.stringify(f.reasonCodes),
            JSON.stringify(f.evidence),
            f.sourceSnippet,
            f.sourceDigest,
            now
          ]);
          activeFindingIds.push(f.id);
          newlyCreatedFindingIds.push(f.id);
        }
      }

      // 8. Update scan record to completed
      await tx.execute(`
        UPDATE scans
        SET status = 'completed',
            sha = ?,
            input_digest = ?,
            files_analyzed = ?,
            findings_count = ?,
            raw_result = ?,
            completed_at = ?
        WHERE id = ?
      `, [headSha, inputDigest, totalFilesAnalyzed, activeFindingIds.length,
        JSON.stringify(persistedScanResult), new Date().toISOString(), scanId]);

      // 9. Update repository status
      const repoStatus = collectedFindings.length > 0 ? 'affected' : 'healthy';
      await tx.execute(`
        UPDATE repositories
        SET status = ?, last_scan_at = ?
        WHERE id = ?
      `, [repoStatus, new Date().toISOString(), repo.id]);
      await replaceRepositoryProviderUsage(tx, {
        repositoryId: repo.id,
        workspaceId: repo.workspace_id,
        scanId,
        observedAt: new Date().toISOString(),
        providerIds: observedProviderIds,
      });

      // 10. Record completed activity
      await tx.execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        `act_${crypto.randomBytes(10).toString('hex')}`,
        userId,
        repo.id,
        'scan_completed',
        'Scan Completed',
        `Identified ${collectedFindings.length} breaking changes in ${repo.full_name} (${totalFilesAnalyzed} files scanned).`,
        new Date().toISOString()
      ]);
      await enqueueNewFindingNotifications(newlyCreatedFindingIds, tx);
    });

    return {
      scanId,
      repositoryId: repo.id,
      sha: headSha,
      filesAnalyzed: totalFilesAnalyzed,
      findingsCount: collectedFindings.length,
      status: 'completed',
      providersDetected: productization
        ? [...new Set([
            ...productization.discoveries.map((discovery) => discovery.providerId),
            ...providersToAnalyze.map((provider) => provider.id),
          ])]
        : providersToAnalyze.map((p) => p.id),
      findings: collectedFindings.map((f) => ({
        id: f.id,
        changeId: f.changeId,
        provider: f.provider,
        title: f.title,
        symbol: f.symbol,
        filePath: f.filePath,
        lineNumber: f.lineNumber,
        severity: f.severity,
        confidence: f.confidence,
      })),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown scan error';
    await db.execute(`
      UPDATE scans
      SET status = 'failed', error_message = ?, completed_at = ?
      WHERE id = ?
    `, [errorMsg, new Date().toISOString(), scanId]);

    throw error;
  }
}
