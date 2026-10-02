import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionRevalidator } from '../apps/web/src/lib/session-revalidation.js';

afterEach(() => vi.useRealTimers());
describe('dashboard session revalidation', () => {
  it('requires a server-validated session before authenticated render', async () => {
    const state = vi.fn(); const expired = vi.fn();
    const session = createSessionRevalidator({ request: async () => ({ status: 401, ok: false }), onState: state, onExpired: expired });
    await session.validate();
    expect(state).toHaveBeenCalledWith('checking');
    expect(state).not.toHaveBeenCalledWith('authenticated');
    expect(expired).toHaveBeenCalledOnce(); session.dispose();
  });
  it('revocation hides the authenticated shell and redirects; a transient failure does not log out', async () => {
    const request = vi.fn().mockResolvedValueOnce({ status: 200, ok: true }).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 401, ok: false });
    const state = vi.fn(); const expired = vi.fn();
    const session = createSessionRevalidator({ request, onState: state, onExpired: expired });
    await session.validate(); await session.validate();
    expect(state).toHaveBeenCalledTimes(1); expect(expired).not.toHaveBeenCalled();
    await session.validate(); expect(state).toHaveBeenLastCalledWith('checking'); expect(expired).toHaveBeenCalledOnce(); session.dispose();
  });
  it('fails closed on initial network failure', async () => {
    const state = vi.fn(); const expired = vi.fn();
    const session = createSessionRevalidator({ request: async () => { throw new Error('network'); }, onState: state, onExpired: expired });
    await session.validate(); expect(state).toHaveBeenCalledWith('unavailable'); expect(expired).not.toHaveBeenCalled(); session.dispose();
  });
  it('coalesces focus/timer requests and ignores an expired response after unmount', async () => {
    let finish!: (value: { status: number; ok: boolean }) => void;
    const request = vi.fn(() => new Promise<{ status: number; ok: boolean }>((resolve) => { finish = resolve; }));
    const state = vi.fn(); const expired = vi.fn();
    const session = createSessionRevalidator({ request, onState: state, onExpired: expired });
    const first = session.validate(); const second = session.validate();
    expect(first).toBe(second); expect(request).toHaveBeenCalledOnce();
    session.dispose(); finish({ status: 401, ok: false }); await first;
    expect(state).not.toHaveBeenCalled(); expect(expired).not.toHaveBeenCalled();
  });
  it('aborts a stuck request and allows a later revalidation', async () => {
    vi.useFakeTimers(); const state = vi.fn();
    const request = vi.fn((signal: AbortSignal) => new Promise<{ status: number; ok: boolean }>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })));
    const session = createSessionRevalidator({ request, onState: state, onExpired: vi.fn(), timeoutMs: 100 });
    const pending = session.validate(); await vi.advanceTimersByTimeAsync(100); await pending;
    expect(state).toHaveBeenCalledWith('unavailable');
    request.mockImplementationOnce(async () => ({ status: 200, ok: true }));
    await session.validate(); expect(state).toHaveBeenLastCalledWith('authenticated'); session.dispose();
  });
});
