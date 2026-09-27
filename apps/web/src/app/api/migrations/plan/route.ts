import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { generateMigrationForFinding } from '@/lib/server/planning-service';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { findingId } = await req.json();
    if (!findingId) {
      return NextResponse.json({ error: 'findingId is required' }, { status: 400 });
    }

    const migration = await generateMigrationForFinding(findingId, user.id);
    return NextResponse.json({ success: true, migration });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration planning failed.';
    console.error('Migration planning failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
