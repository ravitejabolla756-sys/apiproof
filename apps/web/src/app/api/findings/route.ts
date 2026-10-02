import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
           r.name as repo_name, r.full_name as repo_full_name,
           (SELECT p.number FROM pull_requests p WHERE p.repository_id = f.repository_id LIMIT 1) as pr_number,
           (SELECT p.url FROM pull_requests p WHERE p.repository_id = f.repository_id LIMIT 1) as pr_url
    FROM findings f
    JOIN repositories r ON r.id = f.repository_id
    JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
    WHERE wm.user_id = ? AND r.lifecycle = 'active'
  `;
  const params: unknown[] = [user.id];

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

  const findings = await db.query(query, params);

  return NextResponse.json({ findings });
}
