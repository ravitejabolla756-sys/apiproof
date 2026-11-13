'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inAppNotificationAvailability, parseInAppNotificationFeed, type InAppNotification } from '@/lib/in-app-notification-contract';

type FeedState = 'loading' | 'ready' | 'unavailable' | 'error';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [readStateUnavailable, setReadStateUnavailable] = useState(false);
  const [state, setState] = useState<FeedState>('loading');
  const [message, setMessage] = useState('');
  const [retrying, setRetrying] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async (isRetry = false) => {
    setState('loading');
    setMessage('');
    if (isRetry) setRetrying(true);
    try {
      const response = await fetch('/api/account/notifications/feed', { cache: 'no-store' });
      const payload = await response.json() as { notifications?: unknown; status?: unknown; code?: unknown; message?: unknown; error?: unknown };
      const feed = parseInAppNotificationFeed(payload);
      if (!feed) throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to load notifications.');
      setNotifications(feed.notifications);
      setReadStateUnavailable(feed.readState !== 'available');
      if (payload.code === inAppNotificationAvailability.code || payload.status === inAppNotificationAvailability.status) {
        setState('unavailable');
        setMessage(typeof payload.message === 'string' ? payload.message : inAppNotificationAvailability.message);
      } else if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to load notifications.');
      } else {
        setState('ready');
      }
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setRetrying(false);
    }
  }, []);

  useEffect(() => { void loadFeed(); }, [loadFeed]);
  useEffect(() => { if (state === 'error') errorRef.current?.focus(); }, [state]);

  return <div className="w-full max-w-4xl min-w-0 space-y-6 outline-none">
    <div className="min-w-0 border-b border-[#E8E8E5] pb-6">
      <Link href="/dashboard" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#686868] hover:text-[#111111]"><ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" /> Dashboard</Link>
      <h1 className="flex min-w-0 flex-wrap items-center gap-2 break-words text-3xl font-medium tracking-tight text-[#111111]"><Bell className="h-6 w-6 shrink-0 text-purple-700" aria-hidden="true" /> Notifications</h1>
      <p className="mt-2 break-words text-xs text-[#686868]">Review security, account, scan and workspace activity when the approved event feed is available.</p>
    </div>
    {state === 'loading' && <div role="status" aria-live="polite" aria-busy="true" className="flex items-center gap-2 text-xs text-[#686868]"><Loader2 aria-hidden="true" className="h-4 w-4" /> Loading notifications…</div>}
    {state === 'error' && <div ref={errorRef} role="alert" tabIndex={-1} className="flex min-w-0 flex-wrap items-center gap-3 break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2">{message}<Button type="button" onClick={() => void loadFeed(true)} disabled={retrying} aria-busy={retrying ? 'true' : undefined} className="min-h-11 px-3 py-1 text-xs">{retrying ? 'Retrying…' : 'Try again'}</Button></div>}
    {state === 'unavailable' && <div role="status" aria-live="polite" aria-atomic="true" className="space-y-3 rounded-2xl border border-dashed border-[#D8D8D4] bg-[#FAFAF8] p-6"><h2 className="text-sm font-semibold text-[#333333]">Notifications are not available yet</h2><p className="break-words text-xs text-[#686868]">{message}</p><Link href="/dashboard/settings/notifications" className="inline-flex min-h-11 items-center text-xs font-medium text-[#004EE8] underline underline-offset-2">Review notification preferences</Link></div>}
    {state === 'ready' && <section aria-labelledby="notifications-heading" className="min-w-0 rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs"><h2 id="notifications-heading" className="text-sm font-semibold text-[#333333]">Recent notifications</h2>{readStateUnavailable && <p role="status" className="mt-3 rounded-xl border border-dashed border-[#D8D8D4] bg-[#FAFAF8] p-3 text-xs text-[#686868]">These activity items are read-only until notification read-state storage is enabled.</p>}{notifications.length === 0 ? <p className="mt-3 text-xs text-[#686868]">You have no notifications.</p> : <ul className="mt-4 space-y-3">{notifications.map((notification) => <li key={notification.id} className="min-w-0 rounded-xl border border-[#E8E8E5] p-4"><div className="min-w-0">{notification.href ? <Link href={notification.href} className="break-words text-sm font-medium text-[#111111] underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]">{notification.title}<span className="sr-only">, open related item</span></Link> : <p className="break-words text-sm font-medium text-[#111111]">{notification.title}</p>}<p className="mt-1 break-words text-xs text-[#686868]">{notification.message}</p><time dateTime={notification.createdAt} className="mt-2 block text-[11px] text-[#686868]">{new Date(notification.createdAt).toLocaleString()}</time></div></li>)}</ul>}</section>}
  </div>;
}
