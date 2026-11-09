'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Clipboard, Loader2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, formatDisplayDateTime, toSafeDisplayDateTime } from '../../../../lib/date-display-contract.js';
import { parseAuditPage, type AuditEventProjection } from '../../../../lib/organization-audit-contract.js';

interface Workspace { id: string; name: string; slug: string; role: 'owner' | 'member'; }
interface Member { id: string; userId: string; email: string; name: string; role: 'owner' | 'member'; createdAt: string; }
interface Invitation { id: string; email: string; role: 'member'; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; createdAt: string; }
type AuditEvent = AuditEventProjection;

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return response.json() as Promise<T & { error?: string }>;
}

export default function WorkspaceSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [retryingAudit, setRetryingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [retryingMembers, setRetryingMembers] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [retryingInvitations, setRetryingInvitations] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [memberAction, setMemberAction] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const membersErrorRef = useRef<HTMLDivElement>(null);
  const invitationsErrorRef = useRef<HTMLDivElement>(null);
  const auditErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message || error) feedbackRef.current?.focus();
  }, [message, error]);

  useEffect(() => {
    if (membersError) membersErrorRef.current?.focus();
    else if (invitationsError) invitationsErrorRef.current?.focus();
    else if (auditError) auditErrorRef.current?.focus();
  }, [membersError, invitationsError, auditError]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all([
        fetch('/api/workspace/settings'),
        fetch('/api/workspace/members'),
        fetch('/api/workspace/invitations'),
        fetch('/api/workspace/audit'),
      ]);
      const [settings, memberData, invitationData, rawAuditData] = await Promise.all(responses.map((response) => response.json()));
      const auditData = parseAuditPage(rawAuditData);
      if (!responses[0]!.ok || !settings.workspace) throw new Error(settings.error || 'Unable to load workspace settings.');
      setWorkspace(settings.workspace);
      setName(settings.workspace.name);
      setSlug(settings.workspace.slug);
      setMembers(responses[1]!.ok ? memberData.members || [] : []);
      setInvitations(responses[2]!.ok ? invitationData.invitations || [] : []);
      setMembersError(responses[1]!.ok ? null : memberData.error || 'Unable to load workspace members.');
      setInvitationsError(responses[2]!.ok ? null : invitationData.error || 'Unable to load workspace invitations.');
      setAudit(responses[3]!.ok && auditData ? auditData.events : []);
      setAuditCursor(responses[3]!.ok && auditData ? auditData.nextCursor : null);
      setAuditError(responses[3]!.ok && auditData ? null : (responses[3]!.ok ? 'Unable to load administrative audit events.' : rawAuditData.error || 'Unable to load administrative audit events.'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function loadMoreAudit() {
    if (!auditCursor || auditLoading) return;
    setAuditLoading(true);
    setActionStatus('Loading more audit events…');
    setAuditError(null);
    try {
      const response = await fetch(`/api/workspace/audit?cursor=${encodeURIComponent(auditCursor)}`);
      const rawData = await readJson<{ events?: unknown; nextCursor?: unknown }>(response);
      const data = parseAuditPage(rawData);
      if (!response.ok || !data) throw new Error(rawData.error || 'Unable to load more audit events.');
      setAudit((current) => [...current, ...data.events]);
      setAuditCursor(data.nextCursor);
    } catch (loadError) {
      setAuditError(loadError instanceof Error ? loadError.message : 'Unable to load more audit events.');
    } finally {
      setAuditLoading(false);
      setActionStatus(null);
    }
  }

  async function retryAudit() {
    setRetryingAudit(true);
    try {
      const response = await fetch('/api/workspace/audit');
      const rawData = await readJson<{ events?: unknown; nextCursor?: unknown }>(response);
      const data = parseAuditPage(rawData);
      if (!response.ok || !data) throw new Error(rawData.error || 'Unable to load administrative audit events.');
      setAudit(data.events);
      setAuditCursor(data.nextCursor);
      setAuditError(null);
    } catch (loadError) {
      setAuditError(loadError instanceof Error ? loadError.message : 'Unable to load administrative audit events.');
    } finally {
      setRetryingAudit(false);
    }
  }

  async function retryMembers() {
    setRetryingMembers(true);
    try {
      const response = await fetch('/api/workspace/members');
      const data = await readJson<{ members?: Member[] }>(response);
      if (!response.ok || !data.members) throw new Error(data.error || 'Unable to load workspace members.');
      setMembers(data.members);
      setMembersError(null);
    } catch (loadError) {
      setMembersError(loadError instanceof Error ? loadError.message : 'Unable to load workspace members.');
    } finally {
      setRetryingMembers(false);
    }
  }

  async function retryInvitations() {
    setRetryingInvitations(true);
    try {
      const response = await fetch('/api/workspace/invitations');
      const data = await readJson<{ invitations?: Invitation[] }>(response);
      if (!response.ok || !data.invitations) throw new Error(data.error || 'Unable to load workspace invitations.');
      setInvitations(data.invitations);
      setInvitationsError(null);
    } catch (loadError) {
      setInvitationsError(loadError instanceof Error ? loadError.message : 'Unable to load workspace invitations.');
    } finally {
      setRetryingInvitations(false);
    }
  }

  async function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setActionStatus('Saving workspace settings…'); setError(null); setMessage(null);
    try {
      const response = await fetch('/api/workspace/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug }) });
      const data = await readJson<{ workspace?: Workspace }>(response);
      if (!response.ok || !data.workspace) throw new Error(data.error || 'Unable to save workspace settings.');
      setWorkspace(data.workspace); setMessage('Workspace settings updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save workspace settings.');
    } finally { setSaving(false); setActionStatus(null); }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true); setActionStatus('Creating invitation link…'); setError(null); setMessage(null); setInviteUrl(null);
    try {
      const response = await fetch('/api/workspace/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, role: 'member' }) });
      const data = await readJson<{ inviteUrl?: string }>(response);
      if (!response.ok || !data.inviteUrl) throw new Error(data.error || 'Unable to create invitation.');
      setInviteEmail(''); setInviteUrl(data.inviteUrl); setMessage('Invitation created. Copy the link and send it through an approved channel.'); await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create invitation.');
    } finally { setInviting(false); setActionStatus(null); }
  }

  async function changeRole(member: Member, role: 'owner' | 'member') {
    if (!workspace) return;
    setMemberAction(member.id); setActionStatus(`Updating role for ${member.email}…`); setError(null); setMessage(null);
    try {
      const response = await fetch('/api/workspace/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: workspace.id, userId: member.userId, role }) });
      const data = await readJson<{ members?: Member[] }>(response);
      if (!response.ok || !data.members) throw new Error(data.error || 'Unable to update member role.');
      setMembers(data.members); setMessage('Member role updated.');
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Unable to update member role.');
    } finally {
      setMemberAction(null); setActionStatus(null);
    }
  }

  async function removeMember(member: Member) {
    if (!workspace) return;
    if (!window.confirm(`Remove ${member.email} from this workspace? The approved workspace-scoped revocation flow preserves personal sessions and access to other workspaces.`)) return;
    setMemberAction(member.id); setActionStatus(`Removing ${member.email}…`); setError(null); setMessage(null);
    try {
      const response = await fetch('/api/workspace/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: workspace.id, userId: member.userId }) });
      const data = await readJson<Record<string, never>>(response);
      if (!response.ok) throw new Error(data.error || 'Unable to remove member.');
      setMembers((current) => current.filter((item) => item.id !== member.id)); setMessage('Member removed.');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove member.');
    } finally {
      setMemberAction(null); setActionStatus(null);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage('Invitation link copied.');
    } catch {
      setError('Unable to copy the invitation link. Select the link and copy it manually.');
    }
  }

  async function revokeInvitation(invitation: Invitation) {
    if (invitation.acceptedAt || invitation.revokedAt) return;
    if (!window.confirm(`Cancel the invitation for ${invitation.email}? The current link will stop working.`)) return;
    setRevokingInvitationId(invitation.id); setActionStatus(`Cancelling invitation for ${invitation.email}…`); setError(null); setMessage(null);
    try {
      const response = await fetch('/api/workspace/invitations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: invitation.id }),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || 'Unable to cancel invitation.');
      setInvitations((current) => current.map((item) => item.id === invitation.id
        ? { ...item, revokedAt: new Date().toISOString() }
        : item));
      setInviteUrl(null);
      setMessage('Invitation cancelled.');
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Unable to cancel invitation.');
    } finally { setRevokingInvitationId(null); setActionStatus(null); }
  }

  if (loading) return <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="flex items-center gap-2 text-xs text-[#686868] outline-none"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading workspace settings…</div>;

  return (
    <div className="max-w-5xl space-y-6 outline-none">
      <div className="flex flex-col gap-4 border-b border-[#E8E8E5] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/settings" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#686868] hover:text-[#111111]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Workspace settings</Link>
          <h1 className="flex items-center gap-2 text-3xl font-medium tracking-tight text-[#111111]"><Users className="h-6 w-6 text-purple-700" aria-hidden="true" /> Workspace administration</h1>
          <p className="mt-2 text-xs text-[#686868]">Manage the current workspace, membership, invitations, and administrative history.</p>
        </div>
        {workspace && <span className="inline-flex min-h-11 items-center rounded-full border border-[#E8E8E5] bg-white px-3 text-xs font-medium text-[#686868]">{workspace.role === 'owner' ? 'Owner access' : 'Member access'}</span>}
      </div>

      {actionStatus && <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{actionStatus}</p>}
      {message && <div ref={feedbackRef} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-900 focus-visible:ring-offset-2">{message}</div>}
      {error && <div ref={feedbackRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{error}</span>{!workspace && <Button type="button" variant="outline" size="sm" onClick={() => void load()} className="border-rose-300 text-rose-900 hover:bg-rose-100">Retry</Button>}</div>}

      {workspace && workspace.role === 'owner' && (
        <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="workspace-profile-heading">
          <div className="mb-5 flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-purple-700" aria-hidden="true" /><div><h2 id="workspace-profile-heading" className="text-base font-semibold text-[#111111]">Workspace profile</h2><p className="mt-1 text-xs text-[#686868]">The slug is part of future workspace URLs; keep it stable and readable.</p></div></div>
          <form onSubmit={saveWorkspace} aria-busy={saving ? 'true' : undefined} className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="workspace-name" className="mb-1.5 block text-xs font-medium text-[#333333]">Name</label><input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" /></div>
          <div><label htmlFor="workspace-slug" className="mb-1.5 block text-xs font-medium text-[#333333]">Slug</label><input id="workspace-slug" value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={64} required className="min-h-11 w-full rounded-lg border border-[#D9D9D4] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={saving} aria-busy={saving ? 'true' : undefined} className="min-h-11">{saving ? 'Saving…' : 'Save workspace'}</Button></div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="members-heading">
        <div className="mb-5 flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 text-purple-700" aria-hidden="true" /><div><h2 id="members-heading" className="text-base font-semibold text-[#111111]">Members</h2><p className="mt-1 text-xs text-[#686868]">Owners can grant or remove access. At least one owner is always required.</p></div></div>
      {membersError ? <div ref={membersErrorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{membersError}</span><Button type="button" variant="outline" size="sm" disabled={retryingMembers} aria-busy={retryingMembers ? 'true' : undefined} onClick={() => void retryMembers()} className="border-rose-300 text-rose-900 hover:bg-rose-100">Retry members</Button></div> : members.length === 0 ? <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-[#686868]">No workspace members found.</p> : <ul aria-label="Workspace members" className="divide-y divide-[#E8E8E5]">
          {members.map((member) => <li key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-[#111111]">{member.name}</p><p className="truncate text-xs text-[#686868]">{member.email}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#E8E8E5] bg-[#F6F6F4] px-2.5 py-1 text-[11px] font-medium capitalize text-[#686868]">{member.role}</span>{workspace?.role === 'owner' && <><select aria-label={`Role for ${member.email}`} value={member.role} disabled={memberAction !== null} aria-busy={memberAction === member.id ? 'true' : undefined} onChange={(event) => void changeRole(member, event.target.value as 'owner' | 'member')} className="min-h-11 rounded-lg border border-[#D9D9D4] bg-white px-2 text-base"><option value="member">Member</option><option value="owner">Owner</option></select><Button type="button" size="sm" variant="danger" disabled={memberAction !== null} aria-busy={memberAction === member.id ? 'true' : undefined} onClick={() => void removeMember(member)}>{memberAction === member.id ? 'Removing…' : 'Remove'}</Button></>}</div></li>)}
        </ul>}
      </section>

      {workspace?.role === 'owner' && <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="invite-heading">
        <div className="mb-5 flex items-start gap-3"><UserPlus className="mt-0.5 h-5 w-5 text-purple-700" aria-hidden="true" /><div><h2 id="invite-heading" className="text-base font-semibold text-[#111111]">Invite a member</h2><p className="mt-1 text-xs text-[#686868]">Email delivery is not enabled in the beta. Create a single-use link and share it manually. Creating another link for the same email cancels the previous pending link.</p></div></div>
          <form onSubmit={inviteMember} aria-busy={inviting ? 'true' : undefined} className="flex flex-col gap-3 sm:flex-row"><label htmlFor="invite-email" className="sr-only">Invite email</label><input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} autoComplete="email" placeholder="teammate@example.com" required className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#D9D9D4] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]" /><Button type="submit" disabled={inviting} aria-busy={inviting ? 'true' : undefined} className="min-h-11">{inviting ? 'Creating…' : 'Create invite link'}</Button></form>
        {inviteUrl && <div className="mt-4 flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-[11px] text-blue-900">{inviteUrl}</code><Button type="button" size="sm" variant="outline" onClick={() => void copyInvite()} icon={<Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}>Copy link</Button></div>}
        {invitationsError ? <div ref={invitationsErrorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{invitationsError}</span><Button type="button" variant="outline" size="sm" disabled={retryingInvitations} aria-busy={retryingInvitations ? 'true' : undefined} onClick={() => void retryInvitations()} className="border-rose-300 text-rose-900 hover:bg-rose-100">Retry invitations</Button></div> : invitations.length > 0 ? <div className="mt-5 space-y-2"><h3 className="text-xs font-semibold text-[#333333]">Recent invitations</h3><ul aria-label="Recent invitations" className="space-y-2">{invitations.slice(0, 5).map((invitation) => <li key={invitation.id} className="flex flex-col gap-2 rounded-lg border border-[#E8E8E5] bg-[#F6F6F4] p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[#333333]">{invitation.email}</p><p className="text-[#686868]">{invitation.acceptedAt ? 'Accepted' : invitation.revokedAt ? 'Revoked' : formatDisplayDate(invitation.expiresAt)}</p></div>{!invitation.acceptedAt && !invitation.revokedAt && <Button type="button" size="sm" variant="outline" disabled={revokingInvitationId !== null} aria-busy={revokingInvitationId === invitation.id ? 'true' : undefined} onClick={() => void revokeInvitation(invitation)} aria-label={`Cancel invitation for ${invitation.email}`}>{revokingInvitationId === invitation.id ? 'Cancelling…' : 'Cancel'}</Button>}</li>)}</ul></div> : <p role="status" aria-live="polite" aria-atomic="true" className="mt-5 text-xs text-[#686868]">No recent invitations.</p>}
      </section>}

      <section className="rounded-2xl border border-[#E8E8E5] bg-white p-6 shadow-xs" aria-labelledby="audit-heading">
        <div className="mb-5 flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-purple-700" aria-hidden="true" /><div><h2 id="audit-heading" className="text-base font-semibold text-[#111111]">Administrative audit trail</h2><p className="mt-1 text-xs text-[#686868]">Workspace membership and settings changes are attributed to the acting account.</p></div></div>
        {auditError ? <div ref={auditErrorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{auditError}</span><Button type="button" variant="outline" size="sm" disabled={retryingAudit} aria-busy={retryingAudit ? 'true' : undefined} onClick={() => void retryAudit()} className="border-rose-300 text-rose-900 hover:bg-rose-100">Retry audit</Button></div> : audit.length === 0 ? <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-[#686868]">No administrative events recorded yet.</p> : <ul aria-label="Administrative events" className="divide-y divide-[#E8E8E5]">{audit.map((event) => { const safeCreatedAt = toSafeDisplayDateTime(event.createdAt); return <li key={event.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium text-[#333333]">{event.action}</p><p className="text-[11px] text-[#686868]">{event.actorEmail || 'System'} · {event.targetType}</p></div><time className="text-[11px] font-mono text-[#686868]" dateTime={safeCreatedAt ?? undefined}>{formatDisplayDateTime(event.createdAt)}</time></li>; })}</ul>}
        {auditCursor && <Button type="button" variant="outline" className="mt-4 min-h-11" disabled={auditLoading} aria-busy={auditLoading ? 'true' : undefined} onClick={() => void loadMoreAudit()}>{auditLoading ? 'Loading audit events…' : 'Load more audit events'}</Button>}
      </section>
    </div>
  );
}
