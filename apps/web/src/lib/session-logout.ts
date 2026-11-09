/** Validate the explicit success projection returned by the logout action. */
export function parseLogoutResponse(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    && (payload as { success?: unknown }).success === true;
}

/** A failed network/server request must not be represented as successful logout. */
export async function signOutSession(request: (signal: AbortSignal) => Promise<{ ok: boolean; status: number }>, timeoutMs = 15000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(controller.signal);
    if (!response.ok && response.status !== 401) throw new Error('Sign out failed. Your session may still be active. Please try again.');
    // A server-validated 401 is already signed out; other failures are not.
  } finally { clearTimeout(timer); }
}
