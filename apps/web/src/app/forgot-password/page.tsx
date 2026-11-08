'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiProofLogo } from '@/components/ui/logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_password_reset', email }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Password recovery is temporarily unavailable.');
      else setMessage(data.message);
    } catch {
      setError('Unable to submit the request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <><a href="#main-content" className="skip-link">Skip to main content</a><main id="main-content" tabIndex={-1} className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 font-sans outline-none">
      <Link href="/" className="inline-flex min-h-11 items-center gap-3 mb-10">
        <ApiProofLogo className="h-8 w-auto shrink-0" variant="dark" />
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">MY OWL</span>
      </Link>
      <section className="w-full max-w-md rounded-2xl border border-[#E8E8E5] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#0F172A]">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your account email and we’ll send a single-use reset link if an account exists.</p>
        <form onSubmit={submit} aria-busy={loading} className="mt-6 space-y-5">
          <div>
            <label htmlFor="reset-email" className="mb-2 block font-mono text-xs font-medium uppercase tracking-wider text-slate-600">Email</label>
            <input id="reset-email" type="email" required maxLength={255} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#E8E8E5] bg-[#F5F5F7] px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10" />
          </div>
          {message && <p role="status" aria-live="polite" aria-atomic="true" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
          {error && <p role="alert" aria-live="assertive" aria-atomic="true" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0F172A] py-3.5 font-mono text-xs font-medium uppercase tracking-wider text-white disabled:opacity-60">
            <span role={loading ? 'status' : undefined} aria-live={loading ? 'polite' : undefined} aria-atomic={loading ? 'true' : undefined}>{loading ? 'Sending…' : 'Send reset link'}</span>
          </button>
        </form>
        <p className="mt-5 text-center text-sm"><Link href="/login" className="inline-flex min-h-11 items-center justify-center text-slate-600 underline-offset-4 hover:underline">Back to sign in</Link></p>
      </section>
    </main></>
  );
}
