'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Loader2, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { accountDeletionAvailability } from '@/lib/account-deletion-contract';

interface AccountProfile {
  email: string;
  name: string;
  authProviders: string[];
  hasLocalPassword: boolean;
}

export default function AccountSettingsPage() {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message || error) feedbackRef.current?.focus();
  }, [message, error]);

  async function loadAccount(preserveError = false) {
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const response = await fetch('/api/account');
      const data = await response.json() as { account?: AccountProfile; error?: string };
      if (!response.ok || !data.account) throw new Error(data.error || 'Unable to load account settings.');
      setAccount(data.account);
      setName(data.account.name);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load account settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAccount(); }, []);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingName(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json() as { account?: AccountProfile; error?: string };
      if (!response.ok || !data.account) throw new Error(data.error || 'Unable to save your name.');
      setAccount(data.account);
      setName(data.account.name);
      setMessage('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your name.');
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to change your password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(data.message || 'Password updated.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Unable to change your password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div aria-busy={loading || savingName || savingPassword ? 'true' : undefined} className="max-w-4xl space-y-6 outline-none">
      <div className="flex flex-col gap-4 border-b border-[#E8E8E5] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/settings" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#686868] hover:text-[#111111]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Workspace settings
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-medium tracking-tight text-[#111111]">
            <UserRound className="h-6 w-6 text-purple-700" aria-hidden="true" />
            Account settings
          </h1>
          <p className="mt-2 text-xs text-[#686868]">Manage your personal profile and sign-in credentials.</p>
        </div>
      </div>

      {message && <div ref={feedbackRef} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-900 focus-visible:ring-offset-2">{message}</div>}
      {error && <div ref={feedbackRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{error}</span>{!account && <Button type="button" variant="outline" size="sm" disabled={loading} aria-busy={loading ? 'true' : undefined} onClick={() => void loadAccount(true)} className="border-rose-300 text-rose-900 hover:bg-rose-100">{loading ? 'Retrying account load…' : 'Retry account load'}</Button>}</div>}

      {loading ? (
        <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="flex items-center gap-2 rounded-2xl border border-[#E8E8E5] bg-white p-6 text-xs text-[#686868]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading account settings…
        </div>
      ) : account ? (
        <>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="profile-heading">
            <div className="mb-5 flex items-start gap-3">
              <UserRound className="mt-0.5 h-5 w-5 text-purple-700" aria-hidden="true" />
              <div><h2 id="profile-heading" className="text-base font-semibold text-[#111111]">Profile</h2><p className="mt-1 text-xs text-[#686868]">Your name appears in workspace activity and invitations.</p></div>
            </div>
            <form onSubmit={saveName} aria-busy={savingName} className="space-y-4">
              <div>
                <label htmlFor="account-name" className="mb-1.5 block text-xs font-medium text-[#333333]">Display name</label>
                <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={100} required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] bg-white px-3 text-base text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" />
              </div>
              <div>
                <label htmlFor="account-email" className="mb-1.5 block text-xs font-medium text-[#333333]">Email</label>
                <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[#E8E8E5] bg-[#F6F6F4] px-3 text-base text-[#686868]">
                  <Mail className="h-4 w-4" aria-hidden="true" /><input id="account-email" value={account.email} readOnly autoComplete="email" aria-describedby="account-email-help" className="min-w-0 flex-1 bg-transparent outline-none" />
                </div>
                <p id="account-email-help" className="mt-1.5 text-[11px] text-[#686868]">Email changes require a verified account-recovery flow and are not available here.</p>
              </div>
              <Button type="submit" disabled={savingName || name.trim() === account.name} className="min-h-11"><span role={savingName ? 'status' : undefined} aria-live={savingName ? 'polite' : undefined} aria-atomic={savingName ? 'true' : undefined} aria-busy={savingName ? 'true' : undefined}>{savingName ? 'Saving…' : 'Save profile'}</span></Button>
            </form>
          </section>

          <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="security-heading">
            <div className="mb-5 flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-purple-700" aria-hidden="true" />
              <div><h2 id="security-heading" className="text-base font-semibold text-[#111111]">Password</h2><p className="mt-1 text-xs text-[#686868]">Changing it signs out every other active session.</p></div>
            </div>
            {account.hasLocalPassword ? (
              <form onSubmit={changePassword} aria-busy={savingPassword} className="space-y-4">
                <div><label htmlFor="current-password" className="mb-1.5 block text-xs font-medium text-[#333333]">Current password</label><input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" /></div>
                <div><label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-[#333333]">New password</label><input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" /></div>
                <div><label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-[#333333]">Confirm new password</label><input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" /></div>
                <Button type="submit" disabled={savingPassword} className="min-h-11"><span role={savingPassword ? 'status' : undefined} aria-live={savingPassword ? 'polite' : undefined} aria-atomic={savingPassword ? 'true' : undefined} aria-busy={savingPassword ? 'true' : undefined}>{savingPassword ? 'Updating…' : 'Update password'}</span></Button>
              </form>
            ) : (
              <div className="rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] p-4 text-xs text-[#686868]">
                This account uses {account.authProviders.filter((provider) => provider !== 'password').join(' and ') || 'an external provider'} sign-in. Password changes are unavailable until local-password enrollment is implemented.
              </div>
            )}
          </section>
        </div>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6" aria-labelledby="account-deletion-heading">
          <h2 id="account-deletion-heading" className="text-base font-semibold text-amber-950">{accountDeletionAvailability.heading}</h2>
          <p id="account-deletion-help" className="mt-2 max-w-2xl text-xs leading-relaxed text-amber-900">{accountDeletionAvailability.message}</p>
          <Button type="button" disabled aria-describedby="account-deletion-help" className="mt-4 min-h-11">{accountDeletionAvailability.actionLabel}</Button>
        </section>
        </>
      ) : null}
    </div>
  );
}
