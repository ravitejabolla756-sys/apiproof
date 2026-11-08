'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiProofLogo } from '@/components/ui/logo';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    setToken(resetToken);
    if (resetToken) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_password_reset', token, password }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Unable to reset password.');
      else {
        setMessage(data.message);
        setToken('');
        setPassword('');
      }
    } catch {
      setError('Unable to submit the request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <><a href="#main-content" className="skip-link">Skip to main content</a><main id="main-content" tabIndex={-1} className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 font-sans outline-none">
      <Link href="/" className="mb-10 inline-flex min-h-11 items-center gap-3">
        <ApiProofLogo className="h-8 w-auto shrink-0" variant="dark" />
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">MY OWL</span>
      </Link>
      <section className="w-full max-w-md rounded-2xl border border-[#E8E8E5] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#0F172A]">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Reset links expire after 20 minutes and work once.</p>
        <form onSubmit={submit} aria-busy={loading} className="mt-6 space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-2 block font-mono text-xs font-medium uppercase tracking-wider text-slate-600">New password</label>
            <input id="new-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" disabled={!token || loading} value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#E8E8E5] bg-[#F5F5F7] px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 disabled:opacity-60" />
          </div>
          {!token && <p role="alert" aria-live="assertive" aria-atomic="true" className="text-sm text-red-700">This reset link is missing or invalid. Request a new one.</p>}
          {message && <p role="status" aria-live="polite" aria-atomic="true" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
          {error && <p role="alert" aria-live="assertive" aria-atomic="true" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {token && <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0F172A] py-3.5 font-mono text-xs font-medium uppercase tracking-wider text-white disabled:opacity-60"><span role={loading ? 'status' : undefined} aria-live={loading ? 'polite' : undefined} aria-atomic={loading ? 'true' : undefined}>{loading ? 'Updating…' : 'Reset password'}</span></button>}
        </form>
        <p className="mt-5 text-center text-sm"><Link href="/login" className="inline-flex min-h-11 items-center justify-center text-slate-600 underline-offset-4 hover:underline">Back to sign in</Link></p>
      </section>
    </main></>
  );
}
