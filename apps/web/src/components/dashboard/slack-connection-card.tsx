"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseSlackConnectionStatus, type SlackConnectionProjection } from '@/lib/slack-connection-contract';

export function SlackConnectionCard() {
  const [status, setStatus] = useState<SlackConnectionProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'status' | 'connect' | 'disconnect' | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const loadStatus = useCallback(async (preserveError = false) => {
    setLoadingStatus(true);
    if (!preserveError) {
      setError(null);
      setErrorAction(null);
    }
    try {
      const response = await fetch('/api/slack/connection', { cache: 'no-store' });
      const rawData = await response.json() as unknown;
      const data = parseSlackConnectionStatus(rawData);
      const serverError = rawData && typeof rawData === 'object' && 'error' in rawData && typeof rawData.error === 'string'
        ? rawData.error
        : undefined;
      if (!response.ok) throw new Error(serverError || 'Slack status is unavailable.');
      if (!data) throw new Error('Slack status is unavailable.');
      setStatus({ connected: data.connected, teamName: data.teamName });
      setError(null);
      setErrorAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack status is unavailable.');
      setErrorAction('status');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  async function connect(preserveError = false) {
    setBusy(true);
    if (!preserveError) {
      setError(null);
      setErrorAction(null);
    }
    try {
      const response = await fetch('/api/slack/connect', { method: 'POST' });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Slack connection could not be started.');
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack connection could not be started.');
      setErrorAction('connect');
      setBusy(false);
    }
  }

  async function disconnect(preserveError = false) {
    setBusy(true);
    if (!preserveError) {
      setError(null);
      setErrorAction(null);
    }
    try {
      const response = await fetch('/api/slack/connection', { method: 'DELETE' });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Slack could not be disconnected.');
      setStatus({ connected: false, teamName: null });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack could not be disconnected.');
      setErrorAction('disconnect');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="slack-connection-title" className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h3 id="slack-connection-title" className="text-base font-semibold text-[#111111] flex items-center gap-2">
          <MessageSquare aria-hidden="true" className="w-4 h-4 text-purple-700" /> Slack Notifications
        </h3>
        {status?.connected && <span className="px-2.5 py-1 rounded-full bg-[#EEF7F2] text-emerald-800 border border-[#D1EBE0] text-[11px] font-medium flex items-center gap-1">
          <CheckCircle2 aria-hidden="true" className="w-3 h-3 text-emerald-600" /> Slack connected
        </span>}
      </div>
      <p className="text-xs text-[#686868]">Receive new breaking-finding alerts by direct message. The invite-only beta keeps repository changes disabled and requires human review.</p>
      {error && <div ref={errorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="flex flex-wrap items-center gap-2 text-xs text-rose-700 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{error}</span><Button type="button" variant="outline" size="sm" disabled={errorAction === 'status' ? loadingStatus : busy} aria-busy={(errorAction === 'status' ? loadingStatus : busy) ? 'true' : undefined} onClick={() => void (errorAction === 'connect' ? connect(true) : errorAction === 'disconnect' ? disconnect(true) : loadStatus(true))} className="border-rose-300 text-rose-900 hover:bg-rose-100">{errorAction === 'connect' ? (busy ? 'Retrying Slack connection…' : 'Retry Slack connection') : errorAction === 'disconnect' ? (busy ? 'Retrying Slack disconnect…' : 'Retry Slack disconnect') : (loadingStatus ? 'Retrying Slack status…' : 'Retry Slack status')}</Button></div>}
      {busy && <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{status?.connected ? 'Disconnecting Slack…' : 'Connecting Slack…'}</p>}
      {status === null ? error ? <div role="status" aria-live="polite" aria-atomic="true" className="text-xs text-[#686868]">Slack connection status is unavailable.</div> : <div role="status" aria-live="polite" aria-atomic="true" className="text-xs text-[#686868] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />Checking Slack connection…</div> : status.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] p-4">
          <div className="text-xs"><span className="font-semibold text-[#111111]">{status.teamName ?? 'Connected Slack workspace'}</span><span className="block text-[#686868] mt-1">Finding alerts are sent privately to the Slack account that connected this workspace.</span></div>
          <Button type="button" variant="outline" size="sm" onClick={() => void disconnect()} disabled={busy} aria-busy={busy ? 'true' : undefined} className="gap-1.5">
            {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Unplug aria-hidden="true" className="h-3.5 w-3.5" />} Disconnect
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => void connect()} disabled={busy} aria-busy={busy ? 'true' : undefined} className="gap-1.5">
          {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />} Connect Slack
        </Button>
      )}
    </section>
  );
}
