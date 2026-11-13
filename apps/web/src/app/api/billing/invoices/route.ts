import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getAuthorizedWorkspaceInvoiceHistory } from '@/lib/server/billing/invoice-history.js';
import { resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const requestedWorkspaceId = new URL(req.url).searchParams.get('workspaceId');
  try {
    const workspaceId = requestedWorkspaceId ?? (await resolveWorkspaceForRequest(req, user.id)).id;
    return NextResponse.json(await getAuthorizedWorkspaceInvoiceHistory(user.id, workspaceId), {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_CAPABILITY_DENIED') {
      return NextResponse.json({ error: 'Billing access denied.', code: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('access denied')) {
      return NextResponse.json({ error: 'Workspace not found or access denied.', code: 'WORKSPACE_ACCESS_DENIED' }, { status: 404 });
    }
    console.error('Invoice history request failed:', error);
    return NextResponse.json({ error: 'Invoice history is unavailable.', code: 'INVOICE_HISTORY_UNAVAILABLE' }, { status: 503 });
  }
}
