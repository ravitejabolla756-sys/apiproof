'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Loader2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { accountDeletionAvailability } from '@/lib/account-deletion-contract';
import { parseAccountProfileResponse, parsePasswordChangeResponse, type AccountProfileProjection } from '@/lib/account-profile-contract';
import { accountErrorMessage, readAccountErrorCode } from '@/lib/account-error-contract';

export default function AccountSettingsPage() {
  const [account, setAccount] = useState<AccountProfileProjection | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [reviewingDeletion, setReviewingDeletion] = useState(false);
  const [deletionReview, setDeletionReview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAccount() {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/account');
      const payload: unknown = await response.json();
      const parsed = parseAccountProfileResponse(payload);
      if (!response.ok || !parsed) throw new Error(accountErrorMessage(response.status, readAccountErrorCode(payload), 'Unable to load account settings.'));
      setAccount(parsed); setName(parsed.name);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load account settings.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAccount(); }, []);

  async function saveName(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null); setError(null);
    try {
      const response = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const payload: unknown = await response.json();
      const parsed = parseAccountProfileResponse(payload);
      if (!response.ok || !parsed) throw new Error(accountErrorMessage(response.status, readAccountErrorCode(payload), 'Unable to save your name.'));
      setAccount(parsed); setName(parsed.name); setMessage('Profile updated.');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save your name.'); }
    finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setMessage(null); setError(null);
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const payload: unknown = await response.json();
      const parsed = parsePasswordChangeResponse(payload);
      if (!response.ok || !parsed) throw new Error(accountErrorMessage(response.status, readAccountErrorCode(payload), 'Unable to change your password.'));
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage(parsed);
    } catch (passwordError) { setError(passwordError instanceof Error ? passwordError.message : 'Unable to change your password.'); }
    finally { setSaving(false); }
  }

  async function resendVerification() {
    setResendingVerification(true); setMessage(null); setError(null);
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resend_verification' }) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(accountErrorMessage(response.status, readAccountErrorCode(payload), 'Email verification is unavailable.'));
      const code = readAccountErrorCode(payload);
      if (code === 'EMAIL_ALREADY_VERIFIED') {
        setAccount((current) => current ? { ...current, emailVerifiedAt: new Date().toISOString(), emailVerificationState: 'verified' } : current);
        setMessage('Your email is already verified.');
      } else {
        setMessage('A verification email request was accepted. Check your inbox when delivery is configured.');
      }
    } catch (resendError) { setError(resendError instanceof Error ? resendError.message : 'Email verification is unavailable.'); }
    finally { setResendingVerification(false); }
  }

  async function reviewDeletionReadiness() {
    setReviewingDeletion(true); setDeletionReview(null); setError(null);
    try {
      const response = await fetch('/api/account/deletion/plan', {
        method: 'POST',
        headers: { 'Idempotency-Key': `deletion-review-${Date.now().toString(36)}` },
      });
      const payload: unknown = await response.json();
      if (response.ok) {
        setDeletionReview('Deletion planning is available for owner review, but execution remains disabled.');
      } else {
        throw new Error(accountErrorMessage(response.status, readAccountErrorCode(payload), 'Deletion readiness is unavailable.'));
      }
    } catch (reviewError) {
      setDeletionReview(reviewError instanceof Error ? reviewError.message : 'Deletion readiness is unavailable.');
    } finally { setReviewingDeletion(false); }
  }

  return <div className="min-w-0 max-w-4xl space-y-6">
    <div className="border-b border-[#E8E8E5] pb-6"><Link href="/dashboard/settings" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs text-[#686868]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Workspace settings</Link><h1 className="flex items-center gap-2 text-3xl font-medium"><UserRound className="h-6 w-6 text-purple-700" aria-hidden="true" />Account settings</h1><p className="mt-2 text-xs text-[#686868]">Manage your personal profile and sign-in credentials.</p></div>
    {message && <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}
    {error && <div role="alert" aria-live="assertive" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><span>{error}</span>{!account && <Button type="button" variant="outline" onClick={() => void loadAccount()}>Retry</Button>}</div>}
    {loading ? <div role="status" aria-live="polite" aria-busy="true" className="flex items-center gap-2 rounded-2xl border border-[#E8E8E5] bg-white p-6 text-xs text-[#686868]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading account settings…</div> : account && <>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6" aria-labelledby="profile-heading"><h2 id="profile-heading" className="mb-5 text-base font-semibold">Profile</h2><form onSubmit={saveName} className="space-y-4"><div><label htmlFor="account-name" className="mb-1.5 block text-xs font-medium">Display name</label><input id="account-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] px-3 text-base" /></div><div><label htmlFor="account-email" className="mb-1.5 block text-xs font-medium">Email</label><input id="account-email" value={account.email} readOnly className="min-h-11 w-full rounded-lg border border-[#E8E8E5] bg-[#F6F6F4] px-3 text-base text-[#686868]" /></div><Button type="submit" disabled={saving || name.trim() === account.name} className="min-h-11">{saving ? 'Saving…' : 'Save profile'}</Button></form></section>
        <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6" aria-labelledby="security-heading"><h2 id="security-heading" className="mb-5 flex items-center gap-2 text-base font-semibold"><KeyRound className="h-4 w-4 text-purple-700" aria-hidden="true" />Password</h2><form onSubmit={changePassword} className="space-y-4"><input aria-label="Current password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] px-3 text-base" /><input aria-label="New password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] px-3 text-base" /><input aria-label="Confirm new password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] px-3 text-base" /><Button type="submit" disabled={saving} className="min-h-11">{saving ? 'Updating…' : 'Update password'}</Button></form></section>
      </div>
      <section className={`rounded-2xl border p-6 ${account.emailVerificationState === 'verified' ? 'border-emerald-200 bg-emerald-50' : account.emailVerificationState === 'unavailable' ? 'border-[#E8E8E5] bg-white' : 'border-amber-200 bg-amber-50'}`} aria-labelledby="verification-heading"><h2 id="verification-heading" className="text-base font-semibold">Email verification</h2>{account.emailVerificationState === 'verified' ? <p className="mt-2 text-xs text-emerald-800">Your account email is verified.</p> : account.emailVerificationState === 'unavailable' ? <p className="mt-2 text-xs text-[#686868]">Verification status is unavailable until the approved email-verification schema is installed.</p> : <div className="mt-2 flex flex-wrap items-center gap-3"><p className="text-xs text-amber-900">Verify your email before using protected workspace actions.</p><Button type="button" onClick={() => void resendVerification()} disabled={resendingVerification} aria-busy={resendingVerification ? 'true' : undefined} className="min-h-11">{resendingVerification ? 'Requesting…' : 'Resend verification email'}</Button></div>}</section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6" aria-labelledby="account-deletion-heading"><h2 id="account-deletion-heading" className="text-base font-semibold text-amber-950">{accountDeletionAvailability.heading}</h2><p className="mt-2 text-xs text-amber-900">{accountDeletionAvailability.message}</p><Button type="button" onClick={() => void reviewDeletionReadiness()} disabled={reviewingDeletion} aria-busy={reviewingDeletion ? 'true' : undefined} className="mt-4 min-h-11">{reviewingDeletion ? 'Reviewing…' : 'Review deletion requirements'}</Button>{deletionReview && <p role="status" aria-live="polite" className="mt-3 break-words text-xs text-amber-950">{deletionReview}</p>}</section>
    </>}
  </div>;
}
