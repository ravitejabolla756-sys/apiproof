import { NextResponse } from 'next/server';
import { evaluateVerifiedUserPolicy, loadVerifiedUserPolicy, verifiedUserFailure, type VerifiedUserAction } from './verified-user-policy.js';

/**
 * Shared server-side route gate for actions that require a verified account.
 * The caller must already have authenticated the request; verification state is
 * loaded from the server database and never from request input.
 */
export async function verifiedUserRouteFailure(userId: string, action: VerifiedUserAction): Promise<Response | null> {
  const failure = verifiedUserFailure(evaluateVerifiedUserPolicy(await loadVerifiedUserPolicy(userId, action)), action);
  if (!failure) return null;
  return NextResponse.json(failure, {
    status: failure.status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
