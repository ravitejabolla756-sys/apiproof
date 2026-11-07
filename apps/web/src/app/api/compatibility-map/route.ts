import { NextResponse } from 'next/server';
import { evaluateRegisteredNormalizedCompatibility } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import { getCurrentUser } from '../../../lib/server/auth.js';
import { getDatabase } from '../../../lib/server/db/index.js';
import { resolveWorkspaceForRequest } from '../../../lib/server/organization-route.js';
import { loadProviderRegistry } from '../../../lib/server/registry-utils.js';
import { parseScanCompatibilityEvidence, parseScanDiscoveryEvidence, parseScanUsageIR } from '../../../lib/server/scan-compatibility-evidence.js';
import { parseBoundedProductizationProjection } from '../../../lib/server/productization-persistence.js';

interface RepositoryRow {
  id: string;
  name: string;
  owner: string;
  full_name: string;
  default_branch: string;
  latest_scan_status: string | null;
  completed_scan_id: string | null;
  completed_scan_sha: string | null;
  completed_scan_files_analyzed: number | null;
  completed_scan_findings_count: number | null;
  completed_scan_at: string | null;
  completed_scan_raw_result: string | null;
}

interface FindingRow {
  repository_id: string;
  id: string;
  provider: string;
  change_id: string;
  title: string;
  status: string;
  file_path: string;
  symbol: string;
  migration_id: string | null;
  migration_status: string | null;
  pull_request_id: string | null;
  pull_request_number: number | null;
  pull_request_state: string | null;
  pull_request_url: string | null;
  pull_request_created_at: string | null;
}

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Compatibility snapshot for only the authenticated user's active workspace. */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateNoStore });

  const workspace = await resolveWorkspaceForRequest(req, user.id);
  const db = getDatabase();
  const repositories = await db.query<RepositoryRow>(`
    SELECT r.id, r.name, r.owner, r.full_name, r.default_branch,
      (SELECT s.status FROM scans s
       WHERE s.repository_id = r.id
       ORDER BY s.started_at DESC, s.id DESC LIMIT 1) AS latest_scan_status,
      (SELECT s.id FROM scans s
       WHERE s.repository_id = r.id AND s.status = 'completed'
       ORDER BY COALESCE(s.completed_at, s.started_at) DESC, s.id DESC LIMIT 1) AS completed_scan_id,
      (SELECT s.sha FROM scans s
       WHERE s.repository_id = r.id AND s.status = 'completed'
       ORDER BY COALESCE(s.completed_at, s.started_at) DESC, s.id DESC LIMIT 1) AS completed_scan_sha,
      (SELECT s.files_analyzed FROM scans s
       WHERE s.repository_id = r.id AND s.status = 'completed'
       ORDER BY COALESCE(s.completed_at, s.started_at) DESC, s.id DESC LIMIT 1) AS completed_scan_files_analyzed,
      (SELECT s.findings_count FROM scans s
       WHERE s.repository_id = r.id AND s.status = 'completed'
       ORDER BY COALESCE(s.completed_at, s.started_at) DESC, s.id DESC LIMIT 1) AS completed_scan_findings_count,
      (SELECT s.completed_at FROM scans s
       WHERE s.repository_id = r.id AND s.status = 'completed'
       ORDER BY COALESCE(s.completed_at, s.started_at) DESC, s.id DESC LIMIT 1) AS completed_scan_at,
      (SELECT s.raw_result FROM scans s
       WHERE s.repository_id = r.id AND s.status = 'completed'
       ORDER BY COALESCE(s.completed_at, s.started_at) DESC, s.id DESC LIMIT 1) AS completed_scan_raw_result
    FROM repositories r
    WHERE r.workspace_id = ? AND r.lifecycle = 'active' AND r.origin = 'connected'
    ORDER BY r.created_at DESC, r.id ASC
  `, [workspace.id]);

  const findingRows = await db.query<FindingRow>(`
    SELECT f.repository_id, f.id, f.provider, f.change_id, f.title, f.status,
           f.file_path, f.symbol,
           m.id AS migration_id, m.status AS migration_status,
           pr.id AS pull_request_id, pr.number AS pull_request_number,
           pr.state AS pull_request_state, pr.url AS pull_request_url,
           pr.created_at AS pull_request_created_at
    FROM findings f
    JOIN repositories r ON r.id = f.repository_id
    JOIN scans s ON s.id = f.scan_id AND s.status = 'completed'
    LEFT JOIN migrations m ON m.id = (
      SELECT m2.id FROM migrations m2
      WHERE m2.finding_id = f.id AND m2.repository_id = r.id
      ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1
    )
    LEFT JOIN pull_requests pr ON pr.migration_id = m.id AND pr.repository_id = r.id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active' AND r.origin = 'connected'
      AND s.id = (
        SELECT latest.id FROM scans latest
        WHERE latest.repository_id = r.id AND latest.status = 'completed'
        ORDER BY COALESCE(latest.completed_at, latest.started_at) DESC, latest.id DESC LIMIT 1
      )
    ORDER BY f.created_at ASC, f.id ASC
  `, [workspace.id]);

  const findingsByRepository = new Map<string, FindingRow[]>();
  for (const finding of findingRows) {
    const group = findingsByRepository.get(finding.repository_id) ?? [];
    group.push(finding);
    findingsByRepository.set(finding.repository_id, group);
  }

  const responseRepositories = await Promise.all(repositories.map(async (repository) => {
    const findings = findingsByRepository.get(repository.id) ?? [];
    const rawScan: unknown = (() => { try { return repository.completed_scan_raw_result ? JSON.parse(repository.completed_scan_raw_result) : null; } catch { return null; } })();
    const productization = parseBoundedProductizationProjection(rawScan);
    const evidence = parseScanCompatibilityEvidence(repository.completed_scan_raw_result);
    const discovery = parseScanDiscoveryEvidence(repository.completed_scan_raw_result);
    const usageIR = parseScanUsageIR(repository.completed_scan_raw_result);
    const findingProviders = [...new Set(findings.map((finding) => finding.provider))];
    const providersWithEvidence = new Set(evidence?.providers.filter((item) => item.detected).map((item) => item.provider) ?? []);
    const productizationProviders = Array.isArray(productization?.discoveries) ? productization.discoveries.flatMap((item) => item && typeof item === 'object' && typeof (item as { providerId?: unknown }).providerId === 'string' ? [(item as { providerId: string }).providerId] : []) : [];
    const providerIds = [...new Set([...providersWithEvidence, ...findingProviders, ...(discovery?.providers.map((item) => item.providerId) ?? []), ...productizationProviders])];

    const integrations = await Promise.all(providerIds.map(async (provider) => {
      const discovered = productizationProviders.length
        ? (productization?.discoveries as Array<{ providerId: string; providerName?: string; packageName?: string | null; declaredVersion?: string | null; resolvedVersion?: string | null; versionConfidence?: string; capabilities?: string[]; capability?: string }>).find((item) => item.providerId === provider)
        : discovery?.providers.find((item) => item.providerId === provider);
      const analysis = evidence?.providers.find((item) => item.provider === provider && item.detected);
      const changes = await loadProviderRegistry(provider);
      const matchedChangeIds = new Set(findings
        .filter((finding) => finding.provider === provider)
        .map((finding) => finding.change_id));
      const matchedChanges = changes.filter((change) => matchedChangeIds.has(change.id));
      const productizationReviewedCount = Array.isArray(productization?.compatibilityResults)
        ? productization.compatibilityResults.filter((item) => item && typeof item === 'object' && (item as { providerId?: unknown }).providerId === provider).length
        : 0;
      const reviewedChanges = matchedChanges.filter((change) =>
        change.review?.status === 'reviewed' &&
        change.review.reviewer.trim().length > 0 &&
        change.review.reviewedAt.length > 0
      );

      return {
        provider,
        detected: true,
        usageCount: analysis?.usageCount ?? null,
        mappedSymbolCount: analysis?.mappedSymbolCount ?? ('evidenceCount' in (discovered ?? {}) ? (discovered as { evidenceCount?: number }).evidenceCount ?? null : null),
        reviewedChangeCount: productizationReviewedCount || reviewedChanges.length,
        ...(discovered ? {
          providerName: discovered.providerName,
          packageName: discovered.packageName,
          declaredVersion: discovered.declaredVersion,
          resolvedVersion: discovered.resolvedVersion,
          versionConfidence: discovered.versionConfidence,
          capability: discovered.capability,
          capabilities: discovered.capabilities,
        } : {}),
      };
    }));

    const mappedFindings = findings.map((finding) => ({
      id: finding.id,
      provider: finding.provider,
      changeId: finding.change_id,
      title: finding.title,
      status: finding.status,
      filePath: finding.file_path,
      symbol: finding.symbol,
      migration: finding.migration_id ? { id: finding.migration_id, status: finding.migration_status } : null,
      pullRequest: finding.pull_request_id ? {
        id: finding.pull_request_id,
        number: finding.pull_request_number,
        state: finding.pull_request_state,
        url: finding.pull_request_url,
        createdAt: finding.pull_request_created_at,
      } : null,
    }));

    const compatibilityProofs = productization && Array.isArray(productization.proofs)
      ? productization.proofs
      : usageIR && repository.completed_scan_id && repository.completed_scan_sha
      ? buildCompatibilityProofSnapshot({
        repositoryId: repository.id,
        baselineSha: repository.completed_scan_sha,
        scanId: repository.completed_scan_id,
        results: [...new Set(usageIR.map((usage) => usage.providerId))].flatMap((providerId) =>
          evaluateRegisteredNormalizedCompatibility({ providerId, usageIR: usageIR.filter((usage) => usage.providerId === providerId), completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY)),
      })
      : [];

    return {
      id: repository.id,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
      latestScanStatus: repository.latest_scan_status ?? 'not_scanned',
      latestCompletedScan: repository.completed_scan_id ? {
        id: repository.completed_scan_id,
        sha: repository.completed_scan_sha,
        baselineSha: repository.completed_scan_sha,
        filesAnalyzed: Number(repository.completed_scan_files_analyzed ?? 0),
        findingsCount: Number(repository.completed_scan_findings_count ?? 0),
        completedAt: repository.completed_scan_at,
      } : null,
      analysisEvidenceAvailable: evidence !== null || productization !== null,
      integrations,
      openFindingCount: findings.filter((finding) => finding.status === 'open' || finding.status === 'affected').length,
      findings: mappedFindings,
      ...(compatibilityProofs.length > 0 ? { compatibilityProofs } : {}),
    };
  }));

  return NextResponse.json({ workspaceId: workspace.id, repositories: responseRepositories }, { headers: privateNoStore });
}
