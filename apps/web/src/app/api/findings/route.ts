import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db.js';
import { parseBoundedProductizationProjection } from '@/lib/server/productization-persistence.js';
import { resolveFindingCapability } from '@/lib/server/finding-capability.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const repositoryId = searchParams.get('repositoryId');
    const search = searchParams.get('search');

    const db = getDatabase();

    let query = `
    SELECT f.id, f.scan_id, f.repository_id, f.change_id, f.provider, f.title, f.description,
           f.severity, f.confidence, f.file_path, f.line_number, f.symbol, f.status, f.created_at,
           r.name as repo_name, r.full_name as repo_full_name, s.raw_result as scan_raw_result,
           (SELECT p.number FROM pull_requests p JOIN migrations pm ON pm.id = p.migration_id WHERE pm.finding_id = f.id ORDER BY p.created_at DESC LIMIT 1) as pr_number,
           (SELECT p.url FROM pull_requests p JOIN migrations pm ON pm.id = p.migration_id WHERE pm.finding_id = f.id ORDER BY p.created_at DESC LIMIT 1) as pr_url,
           (SELECT p.state FROM pull_requests p JOIN migrations pm ON pm.id = p.migration_id WHERE pm.finding_id = f.id ORDER BY p.created_at DESC LIMIT 1) as pr_state
    FROM findings f
    JOIN scans s ON s.id = f.scan_id AND s.status = 'completed'
    JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active'
  `;
    const params: unknown[] = [workspace.id];

    if (provider && provider !== 'all') {
      query += ' AND f.provider = ?';
      params.push(provider);
    }
    if (severity && severity !== 'all') {
      query += ' AND f.severity = ?';
      params.push(severity);
    }
    if (status && status !== 'all') {
      query += ' AND f.status = ?';
      params.push(status);
    }
    if (repositoryId && repositoryId !== 'all') {
      query += ' AND f.repository_id = ?';
      params.push(repositoryId);
    }
    if (search) {
      query += ' AND (f.title LIKE ? OR f.symbol LIKE ? OR f.file_path LIKE ? OR f.change_id LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY CASE f.severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 ELSE 3 END, f.created_at DESC';

    const findings = await db.query<Record<string, unknown>>(query, params);

    const response = findings.map((finding) => {
      const raw = typeof finding.scan_raw_result === 'string'
        ? (() => { try { return JSON.parse(finding.scan_raw_result); } catch { return null; } })()
        : null;
      const projection = parseBoundedProductizationProjection(raw);
      const capability = resolveFindingCapability(projection, {
        provider: String(finding.provider),
        changeId: String(finding.change_id),
        filePath: String(finding.file_path),
        lineNumber: Number(finding.line_number),
        symbol: String(finding.symbol),
      });
      const publicFinding = { ...(finding as Record<string, unknown>) };
      delete publicFinding.scan_raw_result;
      return { ...publicFinding, capability };
    });

    return NextResponse.json({ findings: response });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
