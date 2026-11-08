import { NextResponse } from 'next/server';
import {
  buildProviderReviewCoverageReport,
  buildProviderReviewPack,
  LOCAL_REVIEWED_PRODUCTION_RECORDS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
} from '@apiproof/providers';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { PROVIDER_CHANGE_SOURCES } from '@/lib/server/provider-change-monitor.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { requireWorkspaceOwner } from '@/lib/server/workspace-service.js';

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: privateNoStore });
  try {
    const workspace = await resolveWorkspaceForRequest(request, user.id);
    await requireWorkspaceOwner(user.id, workspace.id);
    const rows = await getDatabase().query<{
      id: string;
      provider_id: string;
      title: string;
      description: string;
      status: string;
      severity: string;
      payload_json: string;
      source_url: string;
      source_type: string;
      created_at: string;
      reviewed_at: string | null;
      reviewed_by: string | null;
      review_notes: string | null;
    }>(`
      SELECT c.id, c.provider_id, c.status, c.severity, c.payload_json, c.created_at,
             c.reviewed_at, c.reviewed_by, c.review_notes,
             e.title, e.description, e.source_url, s.source_type
      FROM provider_rule_candidates c
      JOIN provider_changelog_entries e ON e.id = c.changelog_entry_id
      JOIN provider_change_sources s ON s.id = e.source_id
      WHERE c.workspace_id IS NULL OR c.workspace_id = ?
      ORDER BY CASE c.status WHEN 'needs_review' THEN 0 ELSE 1 END, c.created_at DESC
      LIMIT 200
    `, [workspace.id]);

    const coverage = buildProviderReviewCoverageReport({
      candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
      monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
      reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
      templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
      expectedProviderCount: 19,
    });
    const reviewPack = buildProviderReviewPack({
      candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
      monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
      reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
      templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
      expectedProviderCount: 19,
    });
    const coverageByCandidate = new Map<string, (typeof coverage.rows)[number]>();
    const packByCandidate = new Map(reviewPack.entries.map((entry) => [entry.candidateId, entry]));
    for (const entry of coverage.rows) {
      coverageByCandidate.set(entry.candidateId, entry);
      const changeId = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.find((candidate) => candidate.candidateId === entry.candidateId)?.payload.changeId;
      if (typeof changeId === 'string') coverageByCandidate.set(entry.providerId + ':' + changeId, entry);
    }

    return NextResponse.json({
      ok: true,
      coverageSummary: coverage.summary,
      candidates: rows.map((row) => {
        const payload = safeJson(row.payload_json);
        const changeId = typeof payload?.changeId === 'string' ? payload.changeId : undefined;
        return {
          id: row.id,
          providerId: row.provider_id,
          title: row.title,
          description: row.description,
          status: row.status,
          severity: row.severity,
          payload,
          source: { url: row.source_url, type: row.source_type },
          createdAt: row.created_at,
          reviewedAt: row.reviewed_at,
          reviewedBy: row.reviewed_by,
          reviewNotes: row.review_notes,
          coverage: coverageByCandidate.get(row.id) ?? (changeId ? coverageByCandidate.get(`${row.provider_id}:${changeId}`) ?? null : null),
          reviewPack: changeId ? packByCandidate.get(changeId) ?? null : null,
        };
      }).sort((a, b) => {
        const rank = { P0: 0, P1: 1, P2: 2 } as const;
        const aRank = a.coverage ? rank[a.coverage.priority] : 3;
        const bRank = b.coverage ? rank[b.coverage.priority] : 3;
        const aStatusRank = a.status === 'needs_review' ? 0 : 1;
        const bStatusRank = b.status === 'needs_review' ? 0 : 1;
        return aRank - bRank || aStatusRank - bStatusRank;
      }),
    }, { headers: privateNoStore });
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (errorCode === 'INVALID_WORKSPACE_ID') {
      const response = organizationErrorResponse(error);
      response.headers.set('Cache-Control', privateNoStore['Cache-Control']);
      return response as NextResponse;
    }
    if (error instanceof Error && error.message.includes('access denied')) {
      return NextResponse.json({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' }, { status: 403, headers: privateNoStore });
    }
    return NextResponse.json({ error: 'Unable to load provider rules', code: 'INTERNAL_ERROR' }, { status: 500, headers: privateNoStore });
  }
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

