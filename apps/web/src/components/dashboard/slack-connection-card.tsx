"use client";

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseSlackConnectResponse, parseSlackStatusResponse, readSlackErrorCode, slackConnectionErrorMessage, type SlackConnectionStatus } from '@/lib/slack-connection-error-contract';

export function SlackConnectionCard() {
  const [status, setStatus] = useState<SlackConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/slack/connection', { cache: 'no-store' });
      const body = await response.json();
      const data = parseSlackStatusResponse(body);
      if (!response.ok || !data) throw new Error(slackConnectionErrorMessage(response.status, readSlackErrorCode(body), 'Slack status is unavailable.'));
      setStatus(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack status is unavailable.');
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/slack/connect', { method: 'POST' });
      const body = await response.json();
      const data = parseSlackConnectResponse(body);
      if (!response.ok || !data) throw new Error(slackConnectionErrorMessage(response.status, readSlackErrorCode(body), 'Slack connection could not be started.'));
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack connection could not be started.');
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/slack/connection', { method: 'DELETE' });
      const body = await response.json();
      const data = parseSlackStatusResponse(body);
      if (!response.ok || !data || data.connected) throw new Error(slackConnectionErrorMessage(response.status, readSlackErrorCode(body), 'Slack could not be disconnected.'));
      setStatus(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Slack could not be disconnected.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="slack-connection-title" className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h3 id="slack-connection-title" className="text-base font-semibold text-[#111111] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-700" /> Slack Notifications
        </h3>
        {status?.connected && <span className="px-2.5 py-1 rounded-full bg-[#EEF7F2] text-emerald-800 border border-[#D1EBE0] text-[11px] font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Slack connected
        </span>}
      </div>
      <p className="text-xs text-[#686868]">Receive new breaking-finding alerts by direct message. The invite-only beta keeps repository changes disabled and requires human review.</p>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {status === null ? <div className="text-xs text-[#686868] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Checking Slack connection…</div> : status.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] p-4">
          <div className="text-xs"><span className="font-semibold text-[#111111]">{status.teamName}</span><span className="block text-[#686868] mt-1">Finding alerts are sent privately to the Slack account that connected this workspace.</span></div>
          <Button type="button" variant="outline" size="sm" onClick={disconnect} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} Disconnect
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={connect} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Connect Slack
        </Button>
      )}
    </section>
  );
}
