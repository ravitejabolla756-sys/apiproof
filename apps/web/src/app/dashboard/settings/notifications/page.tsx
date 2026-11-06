'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Preference { category: string; channel: 'email' | 'slack'; enabled: boolean; required: boolean; deliveryAvailable: boolean; }
const LABELS: Record<string, string> = { security: 'Security alerts', account: 'Account and recovery', findings: 'Breaking findings', migration: 'Migration proposal outcomes', provider_change: 'Provider change alerts', weekly_digest: 'Weekly digest' };

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/account/notifications').then(async (response) => {
      const data = await response.json() as { preferences?: Preference[]; error?: string };
      if (!response.ok || !data.preferences) throw new Error(data.error || 'Unable to load notification preferences.');
      setPreferences(data.preferences);
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load notification preferences.')).finally(() => setLoading(false));
  }, []);

  function toggle(category: string, channel: Preference['channel']) {
    setPreferences((current) => current.map((item) => item.category === category && item.channel === channel && !item.required ? { ...item, enabled: !item.enabled } : item));
  }

  async function save() {
    setSaving(true); setMessage(null); setError(null);
    const response = await fetch('/api/account/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: preferences.map(({ category, channel, enabled }) => ({ category, channel, enabled })) }) });
    const data = await response.json() as { preferences?: Preference[]; error?: string };
    if (!response.ok || !data.preferences) setError(data.error || 'Unable to save notification preferences.');
    else { setPreferences(data.preferences); setMessage('Notification preferences saved.'); }
    setSaving(false);
  }

  const categories = [...new Set(preferences.map((item) => item.category))];
  return <main id="main-content" tabIndex={-1} className="max-w-4xl space-y-6 outline-none"><div className="border-b border-[#E8E8E5] pb-6"><Link href="/dashboard/settings" className="mb-3 inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[#686868] hover:text-[#111111]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Workspace settings</Link><h1 className="flex items-center gap-2 text-3xl font-medium tracking-tight text-[#111111]"><Bell className="h-6 w-6 text-purple-700" aria-hidden="true" /> Notification preferences</h1><p className="mt-2 text-xs text-[#686868]">Choose optional alerts by channel. Security and account-recovery messages remain enabled.</p></div>{message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}{loading ? <div className="flex items-center gap-2 text-xs text-[#686868]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading preferences…</div> : <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="notification-preferences-heading"><h2 id="notification-preferences-heading" className="sr-only">Notification preference controls</h2><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead><tr className="border-b border-[#E8E8E5] text-[#686868]"><th scope="col" className="pb-3 font-medium">Category</th><th scope="col" className="pb-3 text-center font-medium">Email</th><th scope="col" className="pb-3 text-center font-medium">Slack</th></tr></thead><tbody>{categories.map((category) => <tr key={category} className="border-b border-[#E8E8E5] last:border-0"><th scope="row" className="py-4 font-medium text-[#333333]">{LABELS[category] || category}</th>{(['email', 'slack'] as const).map((channel) => { const item = preferences.find((preference) => preference.category === category && preference.channel === channel); return <td key={channel} className="py-4 text-center">{item ? <label className="inline-flex min-h-10 items-center justify-center gap-2"><span className="sr-only">{LABELS[category]} via {channel}</span><input type="checkbox" checked={item.enabled} disabled={item.required || !item.deliveryAvailable} onChange={() => toggle(category, channel)} className="h-4 w-4 accent-[#0050F8]" />{item.required ? <span className="text-[10px] text-[#888888]">Required</span> : !item.deliveryAvailable ? <span className="text-[10px] text-[#888888]">Unavailable</span> : null}</label> : <span className="text-[#888888]">—</span>}</td>; })}</tr>)}</tbody></table></div><p className="mt-5 text-[11px] text-[#888888]">Email delivery is not configured in this beta. Slack choices take effect only when a workspace Slack connection is active.</p><Button type="button" onClick={() => void save()} disabled={saving} className="mt-5 min-h-10">{saving ? 'Saving…' : 'Save preferences'}</Button></section>}</main>;
}
