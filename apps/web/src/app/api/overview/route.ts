import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { getDefaultWorkspaceForUser } from '@/lib/server/workspace-service';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve user's active/default workspace
  const workspace = await getDefaultWorkspaceForUser(user.id);
  const db = getDatabase();

  // Aggregate stats for current workspace
  const repoStats = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM repositories WHERE workspace_id = ?
  `, [workspace.id]);

  const scanStats = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM scans s
    JOIN repositories r ON r.id = s.repository_id
    WHERE r.workspace_id = ? AND s.status = 'completed'
  `, [workspace.id]);

  const findingStats = await db.queryOne<{ total: number; open_count: number | null; critical_count: number | null }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN f.status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN f.severity = 'critical' AND f.status = 'open' THEN 1 ELSE 0 END) as critical_count
    FROM findings f
    JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ?
  `, [workspace.id]);

  const prStats = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM pull_requests pr
    JOIN repositories r ON r.id = pr.repository_id
    WHERE r.workspace_id = ?
  `, [workspace.id]);

  const repositories = await db.query<Array<{
    id: string;
    name: string;
    owner: string;
    full_name: string;
    default_branch: string;
    status: string;
    last_scan_at: string | null;
    findings_count: number;
  }>>(`
    SELECT r.id, r.name, r.owner, r.full_name, r.default_branch, r.status, r.last_scan_at,
           (SELECT COUNT(*) FROM findings f WHERE f.repository_id = r.id) as findings_count
    FROM repositories r
    WHERE r.workspace_id = ?
    ORDER BY r.created_at DESC
  `, [workspace.id]);

  const criticalFinding = await db.queryOne<{
    id: string;
    title: string;
    description: string;
    severity: string;
    symbol: string;
    file_path: string;
    status: string;
    repo_name: string;
    repo_full_name: string;
  }>(`
    SELECT f.id, f.title, f.description, f.severity, f.symbol, f.file_path, f.status,
           r.name as repo_name, r.full_name as repo_full_name
    FROM findings f
    JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ?
    ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, f.created_at DESC
    LIMIT 1
  `, [workspace.id]);

  const recentActivities = await db.query(`
    SELECT a.id, a.type, a.title, a.description, a.created_at, r.name as repo_name
    FROM activity_events a
    JOIN repositories r ON r.id = a.repository_id
    WHERE r.workspace_id = ?
    ORDER BY a.created_at DESC
    LIMIT 6
  `, [workspace.id]);

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: workspace.role,
      repositoryCount: Number(repoStats?.count ?? 0),
      scanCount: Number(scanStats?.count ?? 0),
      openFindingCount: Number(findingStats?.open_count ?? 0),
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    stats: {
      connectedRepositories: Number(repoStats?.count ?? 0),
      scansCompleted: Number(scanStats?.count ?? 0),
      openFindings: Number(findingStats?.open_count ?? 0),
      criticalFindings: Number(findingStats?.critical_count ?? 0),
      draftPrsCount: Number(prStats?.count ?? 0),
    },
    repositories,
    criticalFinding: criticalFinding ?? null,
    recentActivities,
  });
}
