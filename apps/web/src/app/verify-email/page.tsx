'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiProofLogo } from '@/components/ui/logo';
import { parseEmailVerificationError, parseEmailVerificationSuccess } from '@/lib/email-verification-contract';

type ViewState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [state, setState] = useState<ViewState>('loading');
  const [message, setMessage] = useState('Checking your verification link…');
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state !== 'loading') statusRef.current?.focus();
  }, [state]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token. Request a new one from your account.');
      return;
    }

    const controller = new AbortController();
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_email', token }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as unknown;
        if (!response.ok) throw new Error(parseEmailVerificationError(data, 'This verification link is invalid or expired.'));
        const success = parseEmailVerificationSuccess(data);
        if (!success) throw new Error('This verification link is invalid or expired.');
        setState('success');
        setMessage(success.message);
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Unable to verify this email address.');
      });

    return () => controller.abort();
  }, []);

  const heading = state === 'loading' ? 'Verifying your email' : state === 'success' ? 'Email verified' : 'Verification unavailable';

  return (
    <><a href="#main-content" className="skip-link">Skip to main content</a><main id="main-content" tabIndex={-1} className="flex min-h-screen min-w-0 flex-col items-center justify-center bg-[#F5F5F7] px-4 font-sans outline-none">
      <Link href="/" className="mb-10 inline-flex min-h-11 items-center gap-3" aria-label="MY OWL home">
        <ApiProofLogo alt="" className="h-8 w-auto shrink-0" variant="dark" />
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">MY OWL</span>
      </Link>
      <section className="w-full min-w-0 max-w-md rounded-2xl border border-[#E8E8E5] bg-white p-8 text-center shadow-sm" aria-labelledby="verification-heading">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-slate-500">Account security</p>
        <h1 id="verification-heading" className="mt-3 break-words text-xl font-semibold text-[#0F172A]">{heading}</h1>
        <p ref={statusRef} role={state === 'error' ? 'alert' : 'status'} aria-live={state === 'error' ? 'assertive' : 'polite'} aria-atomic="true" aria-busy={state === 'loading' ? 'true' : undefined} tabIndex={state === 'loading' ? undefined : -1} className={`mt-3 break-words text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] focus-visible:ring-offset-2 ${state === 'error' ? 'text-red-700' : 'text-slate-600'}`}>
          {message}
        </p>
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#0F172A] px-5 py-3 font-mono text-xs font-medium uppercase tracking-wider text-white hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8] focus-visible:ring-offset-2">
          Continue to sign in
        </Link>
      </section>
    </main></>
  );
}
