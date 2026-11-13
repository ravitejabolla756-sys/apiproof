import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import {
  getNotificationPreferences,
  NotificationChannelUnavailableError,
  NotificationPreferencesUnavailableError,
  updateNotificationPreferences,
  type NotificationCategory,
  type NotificationChannel,
} from '@/lib/server/notification-preferences-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

function unavailableResponse() {
  return NextResponse.json(
    { error: 'Notification preferences are unavailable until the approved notification schema is installed.', code: 'NOTIFICATION_PREFERENCES_UNAVAILABLE' },
    { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
  );
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    return NextResponse.json({ preferences: await getNotificationPreferences(user.id) }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof NotificationPreferencesUnavailableError) return unavailableResponse();
    throw error;
  }
}

export async function PATCH(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'authenticated_account');
  if (verificationFailure) return verificationFailure;
  try {
    const body = await req.json() as { updates?: unknown };
    if (!Array.isArray(body.updates) || body.updates.some((item) => !item || typeof item !== 'object' || typeof (item as Record<string, unknown>).category !== 'string' || typeof (item as Record<string, unknown>).channel !== 'string' || typeof (item as Record<string, unknown>).enabled !== 'boolean')) {
      return badRequestResponse('updates must be an array of category, channel, and enabled values.');
    }
    const preferences = await updateNotificationPreferences(user.id, body.updates as Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }>);
    return NextResponse.json({ preferences }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    if (error instanceof NotificationPreferencesUnavailableError) return unavailableResponse();
    if (error instanceof NotificationChannelUnavailableError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update notification preferences.', code: 'INVALID_NOTIFICATION_PREFERENCES' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
