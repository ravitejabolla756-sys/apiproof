'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { ApiProofLogo } from '@/components/ui/logo';

type AuthUser = { email?: string };

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const didInitialize = useRef(false);

  useEffect(() => {
    if (didInitialize.current) return;
    didInitialize.current = true;

    async function initialize() {
      try {
        const authResponse = await fetch('/api/auth', { cache: 'no-store' });
        if (!authResponse.ok) {
          router.replace('/login?next=%2Fverify-email');
          return;
        }
        const authData = await authResponse.json() as { user?: AuthUser };
        setEmail(authData.user?.email ?? 'your account email');

        const wasSentDuringSignup = new URLSearchParams(window.location.search).get('sent') === '1';
        if (wasSentDuringSignup) {
          setMessage('A verification code was sent to your email. It expires in 10 minutes.');
          return;
        }
        await sendCode();
      } catch {
        setError('We could not load your account. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, [router]);

  async function sendCode() {
    setError('');
    setResending(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_email_verification' }),
      });
      const data = await response.json() as { error?: string; message?: string; alreadyVerified?: boolean };
      if (!response.ok) throw new Error(data.error || 'Could not send a verification code.');
      if (data.alreadyVerified) {
        setMessage('Your email is already verified.');
        router.replace('/dashboard');
        return;
      }
      setMessage(data.message || 'A verification code was sent to your email.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a verification code.');
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_email', code }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'That code could not be verified.');
      setMessage('Email verified. Taking you back to MY OWL…');
      window.setTimeout(() => router.replace('/dashboard'), 700);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code could not be verified.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 py-10 font-sans">
      <Link href="/" className="flex items-center gap-3 mb-10" aria-label="MY OWL home">
        <ApiProofLogo className="h-8 w-auto shrink-0" variant="dark" />
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">MY OWL</span>
      </Link>

      <section className="w-full max-w-md rounded-2xl border border-[#E8E8E5] bg-white p-8 shadow-sm">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-[#0F172A]">Verify your email</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enter the six-digit code we sent to <span className="font-medium text-slate-800">{email || 'your email address'}</span> to finish verifying your account.
        </p>

        {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label htmlFor="verification-code" className="block font-mono text-xs font-medium uppercase tracking-wider text-slate-600">Email code</label>
          <input
            id="verification-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={loading || submitting}
            className="w-full rounded-xl border border-[#D8DCE5] bg-[#F8FAFC] px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-[#0F172A] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
            aria-describedby="verification-help"
          />
          <p id="verification-help" className="text-xs text-slate-500">The code expires after 10 minutes and can only be used once.</p>
          <button
            type="submit"
            disabled={loading || submitting || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F172A] py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Verify email
          </button>
        </form>

        <button
          type="button"
          onClick={() => void sendCode()}
          disabled={loading || resending}
          className="mt-5 w-full py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-60"
        >
          {resending ? 'Sending code…' : 'Resend code'}
        </button>
        <div className="mt-2 text-center">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">Back to MY OWL</Link>
        </div>
      </section>
    </main>
  );
}
