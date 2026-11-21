'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

type VerificationState = 'loading' | 'success' | 'error';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function safeErrorMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return 'This verification link could not be completed.';
}

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Verifying your email address…');
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const queryToken = new URLSearchParams(window.location.search).get('token');
    const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    const token = queryToken ?? hashToken ?? '';
    window.history.replaceState(null, '', '/verify-email');

    if (!TOKEN_PATTERN.test(token)) {
      setState('error');
      setMessage('This verification link is missing, malformed, or expired. Request a new verification email from account settings.');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify_email', token }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(safeErrorMessage(payload));
        if (cancelled) return;

        const code = payload && typeof payload === 'object' && 'code' in payload ? payload.code : null;
        setState('success');
        setMessage(code === 'EMAIL_ALREADY_VERIFIED'
          ? 'Your email address was already verified.'
          : 'Your email address is verified.');
      } catch (error) {
        if (cancelled) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Email verification is temporarily unavailable.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== 'loading') statusRef.current?.focus();
  }, [state]);

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 py-16 font-sans text-[#000E29]">
      <div ref={statusRef} tabIndex={-1} role={state === 'error' ? 'alert' : 'status'} aria-live="polite" aria-atomic="true" className="w-full max-w-md rounded-3xl border border-[#E8E8E5] bg-white p-8 text-center shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8] focus-visible:ring-offset-2">
        {state === 'loading' ? <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-purple-700" /> : state === 'success' ? <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-emerald-600" /> : <ShieldAlert aria-hidden="true" className="mx-auto h-10 w-10 text-amber-700" />}
        <h1 className="mt-5 text-2xl font-semibold">{state === 'loading' ? 'Verify your email' : state === 'success' ? 'Email verified' : 'Verification unavailable'}</h1>
        <p className="mt-3 text-sm text-[#686868]">{message}</p>
        {state !== 'loading' && <Link href="/login" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#000E29] px-5 text-sm font-medium text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8] focus-visible:ring-offset-2">Continue to sign in</Link>}
      </div>
    </main>
  );
}
