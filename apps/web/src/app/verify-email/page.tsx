'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiProofLogo } from '@/components/ui/logo';

type ViewState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [state, setState] = useState<ViewState>('loading');
  const [message, setMessage] = useState('Checking your verification link…');

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
        const data = await response.json() as { message?: string; error?: string };
        if (!response.ok) throw new Error(data.error || 'This verification link is invalid or expired.');
        setState('success');
        setMessage(data.message || 'Email address verified successfully.');
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F7] px-4 font-sans">
      <Link href="/" className="mb-10 flex items-center gap-3" aria-label="MY OWL home">
        <ApiProofLogo className="h-8 w-auto shrink-0" variant="dark" />
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">MY OWL</span>
      </Link>
      <section className="w-full max-w-md rounded-2xl border border-[#E8E8E5] bg-white p-8 text-center shadow-sm" aria-labelledby="verification-heading">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-slate-500">Account security</p>
        <h1 id="verification-heading" className="mt-3 text-xl font-semibold text-[#0F172A]">{heading}</h1>
        <p role={state === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-3 text-sm ${state === 'error' ? 'text-red-700' : 'text-slate-600'}`}>
          {message}
        </p>
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#0F172A] px-5 py-3 font-mono text-xs font-medium uppercase tracking-wider text-white hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8] focus-visible:ring-offset-2">
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}
