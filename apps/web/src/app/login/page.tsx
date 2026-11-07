'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { ApiProofLogo } from '@/components/ui/logo';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSubmitting = useRef(false);

  // If already authenticated, redirect to /dashboard
  useEffect(() => {
    fetch('/api/auth')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          window.location.href = '/dashboard';
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const googleError = new URLSearchParams(window.location.search).get('google');
    const messages: Record<string, string> = {
      google_denied: 'Google authorization was cancelled.',
      google_account_exists: 'An account already exists for this email. Sign in with your password; Google was not linked automatically.',
      google_oauth_state_invalid: 'The Google sign-in session expired or was invalid. Start again.',
      google_oauth_state_mismatch: 'The Google sign-in session did not match this browser. Start again.',
      google_oauth_state_replayed: 'That Google sign-in callback was already used. Start again.',
      google_oauth_state_expired: 'The Google sign-in session expired. Start again.',
      google_unavailable: 'Google sign-in is not available in this environment.',
      google_token_invalid: 'Google could not verify the sign-in response. Start again.',
      github_denied: 'GitHub authorization was cancelled.',
      github_account_exists: 'An account already exists for this email. Sign in with your password; GitHub was not linked automatically.',
      github_oauth_state_invalid: 'The GitHub sign-in session expired or was invalid. Start again.',
      github_oauth_state_mismatch: 'The GitHub sign-in session did not match this browser. Start again.',
      github_oauth_state_replayed: 'That GitHub sign-in callback was already used. Start again.',
      github_oauth_state_expired: 'The GitHub sign-in session expired. Start again.',
      github_unavailable: 'GitHub sign-in is not available in this environment.',
      github_email_unverified: 'GitHub did not provide a verified email address for this account.',
    };
    const githubError = new URLSearchParams(window.location.search).get('github');
    if (googleError) setError(messages[googleError] || 'Google sign-in could not be completed.');
    if (githubError) setError(messages[githubError] || 'GitHub sign-in could not be completed.');
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting.current || loading) return;

    isSubmitting.current = true;
    setError('');
    setLoading(true);

    try {
      const body: Record<string, string> = {
        action: mode,
        email,
        password,
      };
      if (mode === 'signup') {
        body.name = name;
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        setLoading(false);
        isSubmitting.current = false;
        return;
      }

      // Success: remain in loading state to prevent further clicks,
      // and perform full navigation so the session cookie is transmitted cleanly.
      window.location.href = '/dashboard';
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
      isSubmitting.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 font-sans">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <ApiProofLogo className="h-8 w-auto shrink-0 transition-transform group-hover:scale-105" variant="dark" />
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">
          MY OWL
        </span>
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E8E8E5] shadow-sm p-8">
        {/* Mode Switcher */}
        <div className="flex gap-1 p-1 bg-[#F5F5F7] rounded-xl mb-8">
          <button
            type="button"
            disabled={loading}
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg font-mono text-xs font-medium uppercase tracking-wider transition-all disabled:opacity-60 ${
              mode === 'login'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg font-mono text-xs font-medium uppercase tracking-wider transition-all disabled:opacity-60 ${
              mode === 'signup'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <button
            type="button"
            disabled={loading}
            onClick={() => { window.location.href = '/api/auth/google/start?next=/dashboard'; }}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#D8DCE5] bg-white py-3.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
              <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z" />
              <path fill="#FBBC05" d="M6.54 13.59A5.85 5.85 0 0 1 6.23 12c0-.55.1-1.08.31-1.59V7.88H3.3A9.5 9.5 0 0 0 2.25 12c0 1.49.36 2.9 1.05 4.12l3.24-2.53Z" />
              <path fill="#EA4335" d="M12 6.38c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53C7.31 8.1 9.46 6.38 12 6.38Z" />
            </svg>
            Continue with Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => { window.location.href = '/api/auth/github/start?next=/dashboard'; }}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#D8DCE5] bg-[#0F172A] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.1.79-.25.79-.55v-2.15c-3.2.7-3.87-1.35-3.87-1.35-.53-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.35.78 1.04.78 2.1v3.12c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            Continue with GitHub
          </button>
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block font-mono text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                disabled={loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] border border-[#E8E8E5] text-[#0F172A] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#0F172A]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block font-mono text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] border border-[#E8E8E5] text-[#0F172A] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#0F172A]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="password" className="block font-mono text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] border border-[#E8E8E5] text-[#0F172A] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#0F172A]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0F172A] text-white font-mono text-xs font-medium uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
              </>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        {mode === 'login' && (
          <div className="mt-5 text-center">
            <Link href="/forgot-password" className="text-sm text-slate-600 underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Deterministic AST analysis. No AI required.
      </p>
    </div>
  );
}
