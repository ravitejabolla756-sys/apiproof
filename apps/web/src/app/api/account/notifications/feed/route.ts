import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';
import { inAppNotificationAvailability } from '@/lib/in-app-notification-contract.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  // Do not infer or create persistence here until the approved event schema exists.
  return NextResponse.json(
    { notifications: [], ...inAppNotificationAvailability },
    { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
  );
}
