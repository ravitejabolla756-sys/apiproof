'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ApiProofLogo } from '@/components/ui/logo';

type AuthMode = 'login' | 'signup';

type AuthModalContextValue = {
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

const AUTH_MESSAGES: Record<string, string> = {
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

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) throw new Error('useAuthModal must be used inside AuthModalProvider');
  return context;
}

export function AuthTrigger({ children, className, onClick, mode = 'login' }: { children: ReactNode; className?: string; onClick?: () => void; mode?: AuthMode }) {
  const { openAuth } = useAuthModal();
  return <button type="button" onClick={() => { onClick?.(); openAuth(mode); }} className={className}>{children}</button>;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const openAuth = useCallback((nextMode: AuthMode = 'login') => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode(nextMode);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => restoreFocusRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href="/login"]') : null;
      if (!target) return;
      event.preventDefault();
      const label = target.textContent?.toLowerCase() || '';
      const nextMode: AuthMode = /get started|connect|start .*plan|create account|register/.test(label) ? 'signup' : 'login';
      openAuth(nextMode);
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [openAuth]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  return (
    <AuthModalContext.Provider value={{ openAuth, closeAuth }}>
      {children}
      {open && <AuthDialog mode={mode} onClose={closeAuth} />}
    </AuthModalContext.Provider>
  );
}

export function AuthStandalone() {
  return (
    <main className="auth-galaxy-surface min-h-screen px-5 py-8 font-sans text-white sm:px-8 sm:py-10">
      <AuthDialog mode="login" onClose={() => { window.location.href = '/'; }} standalone />
    </main>
  );
}

function AuthDialog({ mode: initialMode, onClose, standalone = false }: { mode: AuthMode; onClose: () => void; standalone?: boolean }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [nextPath, setNextPath] = useState('/dashboard');
  const isSubmitting = useRef(false);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedNext = params.get('next') || params.get('from');
    if (requestedNext?.startsWith('/')) setNextPath(requestedNext);
    const authError = params.get('google') || params.get('github');
    if (authError) setError(AUTH_MESSAGES[authError] || 'Authentication could not be completed.');
    fetch('/api/auth')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data?.authenticated) window.location.href = requestedNext?.startsWith('/') ? requestedNext : '/dashboard'; })
      .catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting.current || loading) return;
    isSubmitting.current = true;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { action: mode, email, password };
      if (mode === 'signup') body.name = name;
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Authentication failed.');
        setLoading(false);
        isSubmitting.current = false;
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
      isSubmitting.current = false;
    }
  }

  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      className="relative box-border grid max-h-[calc(100dvh-48px)] w-[min(1050px,calc(100vw-32px))] grid-cols-1 overflow-y-auto rounded-[22px] border border-white/20 bg-[#0B1535] shadow-[0_24px_90px_rgba(0,0,0,0.48)] [scrollbar-color:rgba(255,255,255,0.2)_#0B1535] [&::-webkit-scrollbar-track]:bg-[#0B1535] [&::-webkit-scrollbar-thumb]:bg-white/20 lg:h-[min(700px,calc(100dvh-48px))] lg:grid-cols-[60%_40%] lg:overflow-hidden"
      onClick={(event) => event.stopPropagation()}
    >
      <button ref={closeRef} type="button" aria-label="Close sign in" onClick={onClose} disabled={loading} className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/35 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100] disabled:opacity-50">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>

      <section className="auth-galaxy-surface relative min-w-0 flex min-h-[440px] flex-col overflow-hidden px-8 pb-0 pt-8 sm:px-12 lg:min-h-0 lg:px-9">
        <div className="relative z-10 flex items-center gap-2.5">
          <ApiProofLogo className="h-7 w-auto shrink-0" variant="dark" />
          <span className="text-2xl font-bold tracking-tight text-[#061332]">MY OWL</span>
        </div>
        <div className="relative z-10 mt-12 max-w-[420px]">
          <h1 className="font-serif text-4xl font-normal leading-[1.02] tracking-tight text-[#061332]">Know when your APIs change.</h1>
          <p className="mt-5 max-w-[380px] text-base leading-relaxed text-[#061332]">Track, understand, and act on API changes before they break anything.</p>
        </div>
        <img src="/satellite-dish.png" alt="Engraved satellite dish on a mountain ridge" className="pointer-events-none absolute bottom-0 left-1/2 z-0 hidden w-[min(116%,720px)] max-w-none -translate-x-1/2 select-none lg:block" />
      </section>

      <section className="relative min-w-0 bg-[#0B1535] flex items-center justify-center px-8 py-12 text-white sm:px-12 lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:py-12 [scrollbar-color:rgba(255,255,255,0.2)_#0B1535] [&::-webkit-scrollbar-track]:bg-[#0B1535] [&::-webkit-scrollbar-thumb]:bg-white/20">
        <div className="w-full max-w-[330px]">
          <h2 id="auth-dialog-title" className="font-serif text-[1.95rem] font-normal leading-[1.05] tracking-tight text-white">Access your workspace</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/80">Sign in to monitor API changes, review impact, and stay ahead.</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <button type="button" disabled={loading} onClick={() => { window.location.href = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}`; }} className="flex h-10 w-full items-center justify-center gap-3 rounded-lg bg-white text-sm font-semibold text-[#061332] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100] disabled:opacity-60">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" /><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z" /><path fill="#FBBC05" d="M6.54 13.59A5.85 5.85 0 0 1 6.23 12c0-.55.1-1.08.31-1.59V7.88H3.3A9.5 9.5 0 0 0 2.25 12c0 1.49.36 2.9 1.05 4.12l3.24-2.53Z" /><path fill="#EA4335" d="M12 6.38c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53C7.31 8.1 9.46 6.38 12 6.38Z" /></svg>
              Continue with Google
            </button>
            <button type="button" disabled={loading} onClick={() => { window.location.href = `/api/auth/github/start?next=${encodeURIComponent(nextPath)}`; }} className="flex h-10 w-full items-center justify-center gap-3 rounded-lg bg-white text-sm font-semibold text-[#061332] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100] disabled:opacity-60">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.1.79-.25.79-.55v-2.15c-3.2.7-3.87-1.35-3.87-1.35-.53-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.35.78 1.04.78 2.1v3.12c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" /></svg>
              Continue with GitHub
            </button>
            <div className="flex items-center gap-3 py-2 text-[10px] font-mono uppercase tracking-wider text-white/75"><span className="h-px flex-1 bg-white/35" /><span>or use email</span><span className="h-px flex-1 bg-white/35" /></div>
            {mode === 'signup' && <div><label htmlFor="modal-name" className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-white/75">Full Name</label><input id="modal-name" required disabled={loading} value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" className="h-10 w-full rounded-lg border border-white/35 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100]" /></div>}
            <div><label htmlFor="modal-email" className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-white/75">Email</label><input id="modal-email" type="email" required disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-10 w-full rounded-lg border border-white/35 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100]" /></div>
            <div><label htmlFor="modal-password" className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-white/75">Password</label><div className="relative"><input id="modal-password" type={showPassword ? 'text' : 'password'} required minLength={8} disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" className="h-10 w-full rounded-lg border border-white/35 bg-white/[0.03] px-4 pr-12 text-sm text-white placeholder:text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100]" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D0F100]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg></button></div></div>
            {error && <div role="alert" className="rounded-lg border border-red-200/40 bg-red-950/30 px-3 py-2 text-xs text-white">{error}</div>}
            <button type="submit" disabled={loading} className="h-10 w-full rounded-lg bg-[#D0F100] text-sm font-semibold text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">{loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
          <div className="mt-5 text-center text-sm text-white/90">{mode === 'login' ? <>New to MY OWL?{' '}<button type="button" disabled={loading} onClick={() => { setMode('signup'); setError(''); }} className="underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100]">Create an account</button></> : <>Already have an account?{' '}<button type="button" disabled={loading} onClick={() => { setMode('login'); setError(''); }} className="underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100]">Sign in</button></>}</div>
          {mode === 'login' && <div className="mt-4 text-center"><a href="/forgot-password" className="text-sm text-white/90 underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0F100]">Forgot password?</a></div>}
          <p className="mt-7 text-center text-xs text-white/65">Deterministic AST analysis. No AI required.</p>
        </div>
      </section>
    </div>
  );

  if (standalone) return <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">{content}</div>;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(5,8,22,0.55)] p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>{content}</div>;
}
