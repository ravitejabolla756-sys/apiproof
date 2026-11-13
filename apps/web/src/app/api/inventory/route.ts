/**
 * API Inventory & Rule Registry Endpoint.
 *
 * GET /api/inventory
 *
 * Returns real server-backed API provider rule registry state.
 * Reflects the complete provider catalog and active reviewed breaking-change rules.
 */

import { NextResponse } from 'next/server';
import { DISCOVERY_PROVIDERS, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { loadProviderRegistry } from '@/lib/server/registry-utils.js';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { requireRepositoryAccess } from '@/lib/server/workspace-service.js';
import { parseBoundedProductizationProjection } from '@/lib/server/productization-persistence.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';

export interface ProviderInventoryItem {
  id: string;
  name: string;
  category: string;
  status: 'reviewed' | 'detected';
  rulesCount: number;
  description: string;
  rules: Array<{
    id: string;
    title: string;
    severity: string;
    description: string;
  }>;
  capability?: 'discovery' | 'compatibility';
  capabilities?: string[];
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const reviewedProviderIds = [...new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.providerId))];
    const loadedRules = await Promise.all(reviewedProviderIds.map(async (providerId) => [providerId, await loadProviderRegistry(providerId)] as const));
    const rulesByProvider = new Map(loadedRules);
    const providers: ProviderInventoryItem[] = DISCOVERY_PROVIDERS.map((definition) => {
      const rules = rulesByProvider.get(definition.id) ?? [];
      const capabilities = [...new Set([...definition.capabilities, ...(rules.length > 0 ? ['compatibility' as const] : [])])];
      return {
        id: definition.id,
        name: definition.displayName,
        category: definition.category,
        status: rules.length > 0 ? 'reviewed' as const : 'detected' as const,
        capability: rules.length > 0 ? 'compatibility' as const : 'discovery' as const,
        capabilities,
        rulesCount: rules.length,
        description: rules.length > 0
          ? `Reviewed provider compatibility rules with deterministic evidence and guarded remediation where a verified template exists (${capabilities.join(', ')}).`
          : `Static TypeScript/JavaScript discovery (${capabilities.join(', ')}); no reviewed compatibility rules are registered.`,
        rules: rules.map((r) => ({
          id: r.id,
          title: r.title,
          severity: r.severity,
          description: r.description,
        })),
      };
    });

    const url = new URL(req.url);
    const repositoryId = url?.searchParams.get('repositoryId');
    if (repositoryId) {
      const user = await getCurrentUser(req!);
      if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
      let access;
      try { access = await requireRepositoryAccess(repositoryId, user.id); } catch { return NextResponse.json({ error: 'Repository not found', code: 'REPOSITORY_NOT_FOUND' }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS }); }
      const scanId = url?.searchParams.get('scanId');
      const db = getDatabase();
      const scan = await db.queryOne<{ id: string; sha: string; raw_result: string | null }>(scanId
        ? 'SELECT id, sha, raw_result FROM scans WHERE id = ? AND repository_id = ? AND status = \'completed\''
        : 'SELECT id, sha, raw_result FROM scans WHERE repository_id = ? AND status = \'completed\' ORDER BY COALESCE(completed_at, started_at) DESC, id DESC LIMIT 1', scanId ? [scanId, access.repository.id] : [access.repository.id]);
      const projection = parseBoundedProductizationProjection(scan ? (() => { try { return scan.raw_result ? JSON.parse(scan.raw_result) : null; } catch { return null; } })() : null);
      return NextResponse.json({ ok: true, repositoryId: access.repository.id, scanId: scan?.id ?? null, baselineSha: scan?.sha ?? null, productization: projection }, { headers: PRIVATE_NO_STORE_HEADERS });
    }

    return NextResponse.json({
      ok: true,
      providers,
      totalRulesCount: providers.reduce((total, provider) => total + provider.rulesCount, 0),
    });
  } catch {
    console.error('Inventory request failed:', { code: 'INVENTORY_UNAVAILABLE' });
    return NextResponse.json({ ok: false, error: 'Inventory is temporarily unavailable.', code: 'INVENTORY_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
