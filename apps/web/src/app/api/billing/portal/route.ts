import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'BILLING_NOT_AVAILABLE: Customer billing portal is not enabled during the beta.' },
    { status: 403 },
  );
}
