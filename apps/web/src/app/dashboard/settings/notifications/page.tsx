'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { digestAvailability } from '@/lib/digest-notification-contract';
import { parseNotificationPreferences, type NotificationPreference } from '@/lib/notification-preferences-contract';

const LABELS: Record<string, string> = { security: 'Security alerts', account: 'Account and recovery', findings: 'Breaking findings', scan_failure: 'Scan failures', migration: 'Migration proposal outcomes', provider_change: 'Provider change alerts', weekly_digest: 'Weekly digest' };

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [retryingInitialLoad, setRetryingInitialLoad] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const loadPreferences = useCallback(async (preserveFailure = false) => {
    setLoading(true);
    if (!preserveFailure) {
      setInitialLoadFailed(false);
      setError(null);
    } else {
      setRetryingInitialLoad(true);
    }
    try {
      const response = await fetch('/api/account/notifications');
      const data = await response.json() as { error?: string; preferences?: unknown };
      const parsedPreferences = parseNotificationPreferences(data, { requireRequired: true });
      if (!response.ok || !parsedPreferences) throw new Error(data.error || 'Unable to load notification preferences.');
      setPreferences(parsedPreferences);
      setInitialLoadFailed(false);
      setError(null);
    } catch (loadError: unknown) {
      setInitialLoadFailed(true);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notification preferences.');
    } finally {
      setLoading(false);
      setRetryingInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function toggle(category: string, channel: NotificationPreference['channel']) {
    setPreferences((current) => current.map((item) => item.category === category && item.channel === channel && !item.required ? { ...item, enabled: !item.enabled } : item));
  }

  async function save() {
    setSaving(true); setActionStatus('Saving notification preferences…'); setMessage(null); setError(null);
    try {
      const response = await fetch('/api/account/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: preferences.filter(({ category }) => category !== 'weekly_digest').map(({ category, channel, enabled }) => ({ category, channel, enabled })) }) });
      const data = await response.json() as { error?: string; preferences?: unknown };
      const parsedPreferences = parseNotificationPreferences(data, { requireRequired: true });
      if (!response.ok || !parsedPreferences) throw new Error(data.error || 'Unable to save notification preferences.');
      setPreferences(parsedPreferences);
      setMessage('Notification preferences saved.');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save notification preferences.');
    } finally {
      setSaving(false);
      setActionStatus(null);
    }
  }

  const categories = [...new Set(preferences.map((item) => item.category))];
 return <div aria-busy={loading || saving ? 'true' : undefined} className="w-full max-w-4xl min-w-0 space-y-6 outline-none"><div className="border-b border-[#E8E8E5] pb-6"><Link href="/dashboard/settings" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#686868] hover:text-[#111111]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Workspace settings</Link><h1 className="flex items-center gap-2 text-3xl font-medium tracking-tight text-[#111111]"><Bell className="h-6 w-6 text-purple-700" aria-hidden="true" /> Notification preferences</h1><p className="mt-2 text-xs text-[#686868]">Choose optional alerts by channel. Security and account-recovery messages remain enabled.</p></div>{actionStatus && <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{actionStatus}</p>}{message && <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}{error && <div ref={errorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2">{error}{initialLoadFailed && <Button type="button" onClick={() => void loadPreferences(true)} disabled={retryingInitialLoad} aria-busy={retryingInitialLoad ? 'true' : undefined} className="ml-3 min-h-11 px-3 py-1 text-xs">Try again</Button>}</div>}{loading ? <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="flex items-center gap-2 text-xs text-[#686868]"><Loader2 aria-hidden="true" className="h-4 w-4" /> Loading preferences…</div> : initialLoadFailed ? null : <section aria-busy={saving ? 'true' : undefined} className="min-w-0 rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="notification-preferences-heading"><h2 id="notification-preferences-heading" className="sr-only">Notification preference controls</h2><div role="region" aria-label="Notification preferences table" tabIndex={0} className="min-w-0 overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-inset"><table className="w-full table-fixed text-left text-xs"><thead><tr className="border-b border-[#E8E8E5] text-[#686868]"><th scope="col" className="pb-3 font-medium">Category</th><th scope="col" className="pb-3 text-center font-medium">Email</th><th scope="col" className="pb-3 text-center font-medium">Slack</th></tr></thead><tbody>{categories.map((category) => <tr key={category} className="border-b border-[#E8E8E5] last:border-0"><th scope="row" className="py-4 font-medium text-[#333333]">{LABELS[category] || category}</th>{(['email', 'slack'] as const).map((channel) => { const item = preferences.find((preference) => preference.category === category && preference.channel === channel); const digestUnavailable = category === 'weekly_digest' && digestAvailability.status === 'unavailable'; return <td key={channel} className="py-4 text-center">{item ? <label className="inline-flex min-h-11 items-center justify-center gap-2"><span className="sr-only">{LABELS[category]} via {channel}</span><input type="checkbox" checked={digestUnavailable ? false : item.enabled} disabled={item.required || !item.deliveryAvailable || digestUnavailable} aria-describedby={category === 'weekly_digest' ? 'digest-contract-status' : !item.deliveryAvailable ? 'notification-delivery-status' : undefined} onChange={() => toggle(category, channel)} className="h-4 w-4 accent-[#0050F8]" />{item.required ? <span className="text-[10px] text-[#686868]">Required</span> : !item.deliveryAvailable || digestUnavailable ? <span className="text-[10px] text-[#686868]">Unavailable</span> : null}</label> : <span className="text-[#686868]">—</span>}</td>; })}</tr>)}</tbody></table></div><p id="notification-delivery-status" className="mt-5 text-[11px] text-[#686868]">Email delivery is not configured in this beta. Slack choices take effect only when a workspace Slack connection is active.</p><p id="digest-contract-status" role="status" aria-live="polite" aria-atomic="true" className="mt-3 rounded-lg border border-dashed border-[#D8D8D4] bg-[#FAFAF8] p-3 text-[11px] text-[#686868]">{digestAvailability.message}</p><Button type="button" onClick={() => void save()} disabled={saving} aria-busy={saving ? 'true' : undefined} className="mt-5 min-h-11">{saving ? 'Saving…' : 'Save preferences'}</Button></section>}</div>;
}
