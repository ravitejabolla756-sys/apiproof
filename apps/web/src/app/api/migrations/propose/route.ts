import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { createGitHubProposal } from '@/lib/server/proposal-service';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { migrationId } = await req.json();
    if (!migrationId) {
      return NextResponse.json({ error: 'migrationId is required' }, { status: 400 });
    }

    const proposal = await createGitHubProposal(migrationId, user.id);
    return NextResponse.json({ success: true, proposal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proposal generation failed.';
    console.error('Proposal generation failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
