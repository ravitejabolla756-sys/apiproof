export type SessionViewState = 'checking' | 'authenticated' | 'unavailable';

/** Coalesces focus/timer checks and ignores results after the dashboard unmounts. */
export function createSessionRevalidator(options: {
  request: (signal: AbortSignal) => Promise<{ status: number; ok: boolean }>;
  onState: (state: SessionViewState) => void;
  onExpired: () => void;
  timeoutMs?: number;
}) {
  let active = true;
  let authenticated = false;
  let pending: Promise<void> | undefined;
  let controller: AbortController | undefined;
  const validate = (): Promise<void> => {
    if (!active) return Promise.resolve();
    if (pending) return pending;
    controller = new AbortController();
    const signal = controller.signal;
    const timer = setTimeout(() => controller?.abort(), options.timeoutMs ?? 15000);
    pending = (async () => {
      try {
        const response = await options.request(signal);
        if (!active || signal.aborted) return;
        if (response.status === 401) {
          authenticated = false;
          options.onState('checking');
          options.onExpired();
        } else if (response.ok) {
          authenticated = true;
          options.onState('authenticated');
        } else if (!authenticated) options.onState('unavailable');
      } catch {
        if (active && !authenticated) options.onState('unavailable');
      } finally { clearTimeout(timer); pending = undefined; }
    })();
    return pending;
  };
  return { validate, dispose: () => { active = false; controller?.abort(); } };
}
