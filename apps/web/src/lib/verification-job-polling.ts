export interface VerificationJobStatusResponse {
  status?: unknown;
}

export function isVerificationJobActive(status: unknown): boolean {
  return status === 'pending' || status === 'processing' || status === 'verification_in_progress';
}

export function startVerificationJobPolling<T extends VerificationJobStatusResponse>(options: {
  intervalMs: number;
  fetchStatus: () => Promise<T | null>;
  onStatus: (status: T) => void;
  onTerminal: (status: T) => void;
}): () => void {
  let active = true;
  let polling = false;

  const poll = async () => {
    if (!active || polling) return;
    polling = true;
    try {
      const status = await options.fetchStatus();
      if (!active || !status) return;
      options.onStatus(status);
      if (!isVerificationJobActive(status.status)) {
        active = false;
        clearInterval(timer);
        options.onTerminal(status);
      }
    } catch {
      // A transient status API failure is not a terminal verification result.
    } finally {
      polling = false;
    }
  };

  const timer = setInterval(() => void poll(), options.intervalMs);
  void poll();

  return () => {
    active = false;
    clearInterval(timer);
  };
}
