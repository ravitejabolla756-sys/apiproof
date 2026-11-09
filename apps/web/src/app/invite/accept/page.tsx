'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseAcceptedInvitationResponse } from '@/lib/workspace-invitation-contract';

function AcceptInvitationForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'ready' | 'loading' | 'success' | 'error'>(token ? 'ready' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This invitation link is missing its token.');
  const statusRef = useRef<HTMLDivElement>(null);

  async function accept() {
    if (!token) return;
    setState('loading');
    try {
      const response = await fetch('/api/workspace/invitations/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const data = await response.json() as unknown;
      const projection = parseAcceptedInvitationResponse(data);
      const error = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string' ? data.error : null;
      if (!response.ok || !projection) { setMessage(error || 'Unable to accept this invitation.'); setState('error'); return; }
      setMessage(`You joined ${projection.workspaceName}.`); setState('success');
    } catch {
      setMessage('Unable to reach the invitation service. Try again later or sign in with the invited account.');
      setState('error');
    }
  }

  useEffect(() => { if (!token) { setMessage('This invitation link is missing its token.'); setState('error'); } }, [token]);
  useEffect(() => { if (state !== 'ready') statusRef.current?.focus(); }, [state]);

  return <><a href="#main-content" className="skip-link">Skip to main content</a><main id="main-content" tabIndex={-1} className="mx-auto flex min-h-screen min-w-0 max-w-lg flex-col justify-center px-4 py-12 outline-none"><div className="min-w-0 rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs"><h1 className="break-words text-2xl font-medium text-[#111111]">Workspace invitation</h1><p className="mt-2 break-words text-sm text-[#686868]">Accept this invitation with the account that received it.</p>{message && <div ref={statusRef} role={state === 'error' ? 'alert' : 'status'} aria-live={state === 'error' ? 'assertive' : 'polite'} aria-atomic="true" tabIndex={-1} className={`mt-5 break-words rounded-xl border p-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 ${state === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{state === 'success' && <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />}{message}</div>}{state === 'ready' && <Button type="button" onClick={() => void accept()} className="mt-6 min-h-11">Accept invitation</Button>}{state === 'loading' && <div ref={statusRef} role="status" aria-live="polite" aria-atomic="true" aria-busy="true" tabIndex={-1} className="mt-6 flex items-center gap-2 text-xs text-[#686868] outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Accepting invitation…</div>}{state === 'success' && <Link href="/dashboard/settings/workspace" className="mt-6 inline-flex min-h-11 max-w-full items-center break-words rounded-xl bg-[#111111] px-4 text-xs font-medium text-white">Open workspace administration</Link>}{state === 'error' && <Link href="/login" className="mt-6 inline-flex min-h-11 max-w-full items-center break-words rounded-xl border border-[#D9D9D4] px-4 text-xs font-medium text-[#333333]">Sign in with the invited account</Link>}</div></main></>;
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={<><a href="#main-content" className="skip-link">Skip to main content</a><main id="main-content" tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="flex min-h-screen items-center justify-center text-xs text-[#686868] outline-none">Loading invitation…</main></>}><AcceptInvitationForm /></Suspense>;
}
