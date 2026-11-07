'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AcceptInvitationForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'ready' | 'loading' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState('');

  async function accept() {
    setState('loading');
    const response = await fetch('/api/workspace/invitations/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const data = await response.json() as { workspace?: { name: string }; error?: string };
    if (!response.ok || !data.workspace) { setMessage(data.error || 'Unable to accept this invitation.'); setState('error'); return; }
    setMessage(`You joined ${data.workspace.name}.`); setState('success');
  }

  useEffect(() => { if (!token) { setMessage('This invitation link is missing its token.'); setState('error'); } }, [token]);

  return <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12 outline-none"><div className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs"><h1 className="text-2xl font-medium text-[#111111]">Workspace invitation</h1><p className="mt-2 text-sm text-[#686868]">Accept this invitation with the account that received it.</p>{message && <div role={state === 'error' ? 'alert' : 'status'} aria-live={state === 'error' ? 'assertive' : 'polite'} aria-atomic="true" className={`mt-5 rounded-xl border p-3 text-xs ${state === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{state === 'success' && <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />}{message}</div>}{state === 'ready' && <Button type="button" onClick={() => void accept()} className="mt-6 min-h-10">Accept invitation</Button>}{state === 'loading' && <div role="status" aria-live="polite" aria-atomic="true" className="mt-6 flex items-center gap-2 text-xs text-[#686868]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Accepting invitation…</div>}{state === 'success' && <Link href="/dashboard/settings/workspace" className="mt-6 inline-flex min-h-10 items-center rounded-xl bg-[#111111] px-4 text-xs font-medium text-white">Open workspace administration</Link>}{state === 'error' && <Link href="/login" className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-[#D9D9D4] px-4 text-xs font-medium text-[#333333]">Sign in with the invited account</Link>}</div></main>;
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={<main role="status" aria-live="polite" aria-atomic="true" className="flex min-h-screen items-center justify-center text-xs text-[#686868]">Loading invitation…</main>}><AcceptInvitationForm /></Suspense>;
}
