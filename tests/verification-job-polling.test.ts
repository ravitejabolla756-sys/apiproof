import { afterEach, describe, expect, it, vi } from 'vitest';
import { isVerificationJobActive, startVerificationJobPolling } from '../apps/web/src/lib/verification-job-polling.js';

describe('verification job polling contract', () => {
  afterEach(() => vi.useRealTimers());

  it('continues polling for the public in-progress state and stops on a terminal result', async () => {
    vi.useFakeTimers();
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce({ status: 'verification_in_progress' })
      .mockResolvedValueOnce({ status: 'completed' });
    const onStatus = vi.fn();
    const onTerminal = vi.fn();
    const stop = startVerificationJobPolling({ intervalMs: 3000, fetchStatus, onStatus, onTerminal });

    await vi.waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));
    expect(isVerificationJobActive(onStatus.mock.calls[0]?.[0]?.status)).toBe(true);
    expect(isVerificationJobActive('verification_in_progress')).toBe(true);
    expect(isVerificationJobActive('completed')).toBe(false);

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(onTerminal).toHaveBeenCalledWith({ status: 'completed' });
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps the propose action disabled for every active public job state', () => {
    for (const status of ['pending', 'processing', 'verification_in_progress']) {
      expect(isVerificationJobActive(status)).toBe(true);
    }
    for (const status of ['completed', 'failed', 'execution_unavailable', 'unknown_terminal']) {
      expect(isVerificationJobActive(status)).toBe(false);
    }
  });
});
