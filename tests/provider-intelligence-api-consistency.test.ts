import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET as getMap } from '../apps/web/src/app/api/compatibility-map/route.js';
import { GET as getInventory } from '../apps/web/src/app/api/inventory/route.js';
import { GET as getProof } from '../apps/web/src/app/api/repositories/[id]/scans/[scanId]/compatibility-proof/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';

const DB_PATH = path.resolve('.tmp/provider-intelligence-api-consistency.db');
const BASELINE = 'c'.repeat(40);
const SCAN_ID = 'scan_consistency';
const RAW_RESULT = JSON.stringify({
  schemaVersion: 2,
  productization: {
    schemaVersion: 2,
    baselineSha: BASELINE,
    scanId: SCAN_ID,
    timingsMs: { discovery: 1, analysis: 2, compatibility: 1, proof: 1, total: 5 },
    metrics: { totalFiles: 3, analyzedFiles: 3, providerEvidenceNodes: 2, normalizedUsages: 2, reviewedChangesConsidered: 10, findings: 2 },
    languages: [{ language: 'typescript', evidenceCount: 2 }],
    discoveries: [{ providerId: 'openai', providerName: 'OpenAI', packageName: 'openai', declaredVersion: '^4.0.0', resolvedVersion: '4.0.0', versionSource: 'package.json', versionConfidence: 'declared-only', evidenceCount: 1 }],
    usageIR: [],
    compatibilityResults: [
      { proofId: 'proof-affected', repositoryId: 'repo_consistency_a', baselineSha: BASELINE, scanId: SCAN_ID, providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', status: 'AFFECTED', severity: 'high', matchedModel: 'gpt-4.5-preview', exactFile: 'src/client.ts', exactLine: 4, reasonCodes: ['MATCHED_STATIC_USAGE'], evidenceCoverage: 'complete' },
      { proofId: 'proof-review', repositoryId: 'repo_consistency_a', baselineSha: BASELINE, scanId: SCAN_ID, providerId: 'openai', changeId: 'openai-assistants-api-sunset-2026-08-26', status: 'NEEDS_REVIEW', severity: 'high', matchedResource: 'dynamic-resource', exactFile: 'src/client.ts', exactLine: 7, reasonCodes: ['RESOURCE_UNRESOLVED'], evidenceCoverage: 'partial' },
    ],
    proofs: [
      { proofId: 'proof-affected', repositoryId: 'repo_consistency_a', baselineSha: BASELINE, scanId: SCAN_ID, providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', status: 'AFFECTED', severity: 'high', exactFile: 'src/client.ts', exactLine: 4, matchedModel: 'gpt-4.5-preview', reasonCodes: ['MATCHED_STATIC_USAGE'], officialSourceUrl: 'https://platform.openai.com/docs/deprecations', reviewStatus: 'reviewed', provenance: 'official' },
      { proofId: 'proof-review', repositoryId: 'repo_consistency_a', baselineSha: BASELINE, scanId: SCAN_ID, providerId: 'openai', changeId: 'openai-assistants-api-sunset-2026-08-26', status: 'NEEDS_REVIEW', severity: 'high', exactFile: 'src/client.ts', exactLine: 7, matchedResource: 'dynamic-resource', reasonCodes: ['RESOURCE_UNRESOLVED'], officialSourceUrl: 'https://platform.openai.com/docs/deprecations', reviewStatus: 'reviewed', provenance: 'official' },
    ],
    truncated: false,
  },
});

beforeEach(() => {
  process.env.APIPROOF_SECRET = 'provider-intelligence-api-consistency-secret';
  process.env.APIPROOF_DB_PATH = DB_PATH;
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  initDatabase(DB_PATH);
});

afterEach(async () => {
  await closeDatabase();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
});

async function createRepository(userId: string, repositoryId: string, workspaceId: string): Promise<void> {
  await getDatabase().execute(`
    INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
    VALUES (?, ?, ?, 'consistency-org', ?, ?, ?, 'main', 'healthy', 'connected', 'active', ?)
  `, [repositoryId, workspaceId, userId, repositoryId, `consistency-org/${repositoryId}`, `gh-${repositoryId}`, new Date().toISOString()]);
  await getDatabase().execute(`
    INSERT INTO scans (id, repository_id, sha, status, provider, files_analyzed, findings_count, raw_result, started_at, completed_at)
    VALUES (?, ?, ?, 'completed', 'multi-provider', 3, 2, ?, ?, ?)
  `, [SCAN_ID + '_' + repositoryId, repositoryId, BASELINE, RAW_RESULT.replaceAll('repo_consistency_a', repositoryId).replaceAll(SCAN_ID, SCAN_ID + '_' + repositoryId), new Date().toISOString(), new Date().toISOString()]);
}

describe('provider-intelligence API consistency and tenant boundaries', () => {
  it('returns the same scan identity, proof statuses, locations, and baseline through proof, inventory, and map APIs', async () => {
    const { user, session } = await createUserWithSession('consistency-a@example.com', 'Pass1234!', 'Consistency A');
    const workspace = await (await import('../apps/web/src/lib/server/workspace-service.js')).getDefaultWorkspaceForUser(user.id);
    const repositoryId = 'repo_consistency_a';
    await createRepository(user.id, repositoryId, workspace.id);

    const proof = await getProof(new Request('http://localhost', { headers: { cookie: `apiproof_session=${session.id}` } }), { params: Promise.resolve({ id: repositoryId, scanId: SCAN_ID + '_' + repositoryId }) });
    const proofBody = await proof.json() as { productization: { baselineSha: string; scanId: string; proofs: Array<Record<string, unknown>> } };
    const inventory = await getInventory(new Request(`http://localhost/api/inventory?repositoryId=${repositoryId}`, { headers: { cookie: `apiproof_session=${session.id}` } }));
    const inventoryBody = await inventory.json() as { productization: { baselineSha: string; scanId: string; proofs: Array<Record<string, unknown>> } };
    const catalog = await getInventory(new Request('http://localhost/api/inventory'));
    const catalogBody = await catalog.json() as { totalRulesCount: number; providers: Array<{ id: string; rulesCount: number; status: string }> };
    const map = await getMap(new Request('http://localhost/api/compatibility-map', { headers: { cookie: `apiproof_session=${session.id}` } }));
    const mapBody = await map.json() as { repositories: Array<{ latestCompletedScan: { id: string; baselineSha: string }; compatibilityProofs: Array<Record<string, unknown>> }> };

    expect(proof.status).toBe(200);
    expect(inventory.status).toBe(200);
    expect(catalog.status).toBe(200);
    expect(catalogBody.totalRulesCount).toBeGreaterThan(2);
    const openaiProvider = catalogBody.providers.find((provider) => provider.id === 'openai');
    expect(openaiProvider?.status).toBe('reviewed');
    expect(openaiProvider?.rulesCount).toBeGreaterThan(0);
    expect(map.status).toBe(200);
    const mapRepo = mapBody.repositories[0]!;
    for (const body of [proofBody, inventoryBody]) {
      expect(body.productization.scanId).toBe(SCAN_ID + '_' + repositoryId);
      expect(body.productization.baselineSha).toBe(BASELINE);
      expect(body.productization.proofs.map((item) => [item.changeId, item.status, item.exactFile, item.exactLine])).toEqual([
        ['openai-gpt-4-5-preview-removal-2025-07-14', 'AFFECTED', 'src/client.ts', 4],
        ['openai-assistants-api-sunset-2026-08-26', 'NEEDS_REVIEW', 'src/client.ts', 7],
      ]);
    }
    expect(mapRepo.latestCompletedScan.id).toBe(SCAN_ID + '_' + repositoryId);
    expect(mapRepo.latestCompletedScan.baselineSha).toBe(BASELINE);
    expect(mapRepo.compatibilityProofs.map((item) => [item.changeId, item.status, item.exactFile, item.exactLine])).toEqual(proofBody.productization.proofs.map((item) => [item.changeId, item.status, item.exactFile, item.exactLine]));
  });

  it('denies cross-tenant proof and inventory access and does not expose the other tenant in the map', async () => {
    const first = await createUserWithSession('consistency-owner-a@example.com', 'Pass1234!', 'Owner A');
    const second = await createUserWithSession('consistency-owner-b@example.com', 'Pass1234!', 'Owner B');
    const workspaceA = await (await import('../apps/web/src/lib/server/workspace-service.js')).getDefaultWorkspaceForUser(first.user.id);
    const workspaceB = await (await import('../apps/web/src/lib/server/workspace-service.js')).getDefaultWorkspaceForUser(second.user.id);
    await createRepository(first.user.id, 'repo_tenant_a', workspaceA.id);
    await createRepository(second.user.id, 'repo_tenant_b', workspaceB.id);

    const deniedProof = await getProof(new Request('http://localhost', { headers: { cookie: `apiproof_session=${first.session.id}` } }), { params: Promise.resolve({ id: 'repo_tenant_b', scanId: SCAN_ID + '_repo_tenant_b' }) });
    const deniedInventory = await getInventory(new Request('http://localhost/api/inventory?repositoryId=repo_tenant_b', { headers: { cookie: `apiproof_session=${first.session.id}` } }));
    const ownMap = await getMap(new Request('http://localhost/api/compatibility-map', { headers: { cookie: `apiproof_session=${first.session.id}` } }));
    const otherMap = await getMap(new Request('http://localhost/api/compatibility-map', { headers: { cookie: `apiproof_session=${second.session.id}` } }));

    expect(deniedProof.status).toBe(404);
    expect(deniedInventory.status).toBe(404);
    expect((await ownMap.json() as { repositories: Array<{ id: string }> }).repositories.map((repo) => repo.id)).toEqual(['repo_tenant_a']);
    expect((await otherMap.json() as { repositories: Array<{ id: string }> }).repositories.map((repo) => repo.id)).toEqual(['repo_tenant_b']);
    expect((await getMap(new Request('http://localhost/api/compatibility-map'))).status).toBe(401);
  });
});
