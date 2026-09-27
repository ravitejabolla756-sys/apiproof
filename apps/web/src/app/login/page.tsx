'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiProofLogo } from '@/components/ui/logo';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 font-sans">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-[#E8E8E5] flex items-center justify-center shadow-xs overflow-hidden transition-transform group-hover:scale-105">
          <ApiProofLogo className="w-5 h-5 text-[#0F172A]" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">
          APIProof
        </span>
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E8E8E5] shadow-sm p-8">
        {/* Mode Switcher */}
        <div className="flex gap-1 p-1 bg-[#F5F5F7] rounded-xl mb-8">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg font-mono text-xs font-medium uppercase tracking-wider transition-all ${
              mode === 'login'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg font-mono text-xs font-medium uppercase tracking-wider transition-all ${
              mode === 'signup'
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block font-mono text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] border border-[#E8E8E5] text-[#0F172A] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#0F172A]/20 transition-all"
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] border border-[#E8E8E5] text-[#0F172A] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#0F172A]/20 transition-all"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] border border-[#E8E8E5] text-[#0F172A] text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#0F172A]/20 transition-all"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0F172A] text-white font-mono text-xs font-medium uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'
            }
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Deterministic AST analysis. No AI required.
      </p>
    </div>
  );
}
