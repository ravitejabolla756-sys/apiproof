import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOutSession } from '../apps/web/src/lib/session-logout.js';

afterEach(() => vi.useRealTimers());

describe('truthful dashboard logout', () => {
  it('permits navigation only after the server acknowledges logout', async () => {
    await expect(signOutSession(async () => ({ status: 200, ok: true }))).resolves.toBeUndefined();
  });
  it('treats an already expired session as signed out', async () => {
    await expect(signOutSession(async () => ({ status: 401, ok: false }))).resolves.toBeUndefined();
  });
  it.each([403, 500, 503])('does not claim logout succeeded after HTTP %s', async (status) => {
    await expect(signOutSession(async () => ({ status, ok: false }))).rejects.toThrow('session may still be active');
  });
  it('does not claim logout succeeded after a network failure', async () => {
    await expect(signOutSession(async () => { throw new Error('network unavailable'); })).rejects.toThrow('network unavailable');
  });
  it('aborts a stuck logout request instead of leaving the button pending forever', async () => {
    vi.useFakeTimers();
    const pending = signOutSession((signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })), 100);
    const rejected = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });
});
