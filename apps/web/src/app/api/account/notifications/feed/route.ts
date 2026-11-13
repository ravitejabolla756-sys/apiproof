import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';
import { parseInAppNotifications, type InAppNotificationCategory } from '@/lib/in-app-notification-contract.js';

function categoryForActivity(type: string): InAppNotificationCategory {
  const normalized = type.toLowerCase();
  if (normalized.includes('security') || normalized.includes('auth')) return 'security';
  if (normalized.includes('scan') && normalized.includes('fail')) return 'scan_failure';
  if (normalized.includes('migration') || normalized.includes('proposal') || normalized.includes('pull_request')) return 'migration';
  if (normalized.includes('provider')) return 'provider_change';
  if (normalized.includes('finding')) return 'findings';
  return 'account';
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  try {
    const rows = await getDatabase().query<{
      id: string;
      type: string;
      title: string;
      description: string;
      created_at: string;
      repository_id: string | null;
    }>(`
      SELECT a.id, a.type, a.title, a.description, a.created_at, a.repository_id
      FROM activity_events a
      LEFT JOIN repositories r ON r.id = a.repository_id
      LEFT JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
      WHERE (wm.user_id = ? AND r.lifecycle = 'active') OR (a.repository_id IS NULL AND a.user_id = ?)
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 50
    `, [user.id, user.id]);
    const notifications = rows.map((row) => ({
      id: `activity:${row.id}`,
      category: categoryForActivity(row.type),
      title: row.title,
      message: row.description,
      createdAt: row.created_at,
      readAt: null,
      href: row.repository_id ? `/dashboard/repositories/${encodeURIComponent(row.repository_id)}` : null,
    }));
    const parsed = parseInAppNotifications({ notifications });
    if (!parsed) return NextResponse.json({ error: 'Notification projection is unavailable.', code: 'IN_APP_NOTIFICATIONS_PROJECTION_INVALID' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    return NextResponse.json({ notifications: parsed, status: 'projection', readState: 'unavailable' }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: 'In-app notifications are temporarily unavailable.', code: 'IN_APP_NOTIFICATIONS_SCHEMA_PENDING' },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
